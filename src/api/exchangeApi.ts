import { EXCHANGE_ACTION_FLOW, EXCHANGE_BUNDLE_MAX, ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { FORM_MESSAGES } from '@/constants/messages';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { exchangeInvolvedItemIds } from '@/models/exchange';

import { itemApi } from './itemApi';
import { storage, STORAGE_KEYS } from '@/utils/storage';

const seedExchanges: Exchange[] = [
  {
    id: 'exchange_seed',
    from_user_id: 'user_me',
    to_user_id: 'user_lin',
    from_item_id: 'item_chair',
    to_item_id: 'item_camera',
    status: ExchangeStatus.PENDING,
    message: '露营椅换拍立得，可以同城当面交换。',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'exchange_seed_bundle',
    from_user_id: 'user_me',
    to_user_id: 'user_lin',
    from_item_id: 'item_chair',
    from_item_ids: ['item_chair', 'item_keyboard'],
    to_item_id: 'item_camera',
    status: ExchangeStatus.PENDING,
    message: '露营椅加机械键盘，两件一起换你的拍立得，逐件看看成色都写在描述里。',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

export const exchangeApi = {
  async list(): Promise<Exchange[]> {
    const exchanges = await storage.get<Exchange[]>(STORAGE_KEYS.exchanges, []);
    if (exchanges.length) return exchanges;
    await storage.set(STORAGE_KEYS.exchanges, seedExchanges);
    return seedExchanges;
  },

  async create(draft: ExchangeDraft): Promise<Exchange> {
    const exchanges = await this.list();
    const targetItem = await itemApi.detail(draft.to_item_id);
    if (!targetItem || targetItem.status !== ItemStatus.AVAILABLE) {
      throw new Error('目标物品当前不可交换');
    }
    const fromItemIds = [...new Set(draft.from_item_ids?.length ? draft.from_item_ids : [draft.from_item_id])].filter(
      Boolean,
    );
    if (!fromItemIds.length) {
      throw new Error(FORM_MESSAGES.exchangeBundleEmpty);
    }
    if (fromItemIds.length > EXCHANGE_BUNDLE_MAX) {
      throw new Error(FORM_MESSAGES.exchangeBundleMax);
    }
    // 占用校验：组里有一件已被别的方案占用就发不出去，并指出哪件
    const occupiedTitles: string[] = [];
    for (const itemId of fromItemIds) {
      const item = await itemApi.detail(itemId);
      const occupiedByOther = exchanges.some(
        (exchange) => exchange.status === ExchangeStatus.ACCEPTED && exchangeInvolvedItemIds(exchange).includes(itemId),
      );
      if (!item || item.status !== ItemStatus.AVAILABLE || occupiedByOther) {
        occupiedTitles.push(item?.title ?? itemId);
      }
    }
    if (occupiedTitles.length) {
      throw new Error(`「${occupiedTitles.join('」「')}」${FORM_MESSAGES.exchangeItemOccupied}，先移出这组再发起`);
    }
    const nextExchange: Exchange = {
      ...draft,
      from_item_id: fromItemIds[0],
      from_item_ids: fromItemIds,
      id: storage.createId('exchange'),
      status: draft.status ?? ExchangeStatus.PENDING,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await storage.set(STORAGE_KEYS.exchanges, [nextExchange, ...exchanges]);
    return nextExchange;
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
      throw new Error('当前状态不允许该操作');
    }
    const now = new Date().toISOString();
    const nextExchange: Exchange = { ...current, status, updated_at: now };
    let nextExchanges = exchanges.map((item) => (item.id === id ? nextExchange : item));
    if (status === ExchangeStatus.ACCEPTED) {
      // 整组答应：组内物品和换来的那件一起进入交换中
      const lockedItemIds = exchangeInvolvedItemIds(current);
      for (const itemId of lockedItemIds) {
        await itemApi.setStatus(itemId, ItemStatus.EXCHANGING);
      }
      // 盯上这些物品的其他待确认请求标为已另行达成
      nextExchanges = nextExchanges.map((item) =>
        item.id !== id &&
        item.status === ExchangeStatus.PENDING &&
        exchangeInvolvedItemIds(item).some((itemId) => lockedItemIds.includes(itemId))
          ? { ...item, status: ExchangeStatus.ELSEWHERE, updated_at: now }
          : item,
      );
    }
    if (status === ExchangeStatus.COMPLETED) {
      // 完成时整组归为已交换
      for (const itemId of exchangeInvolvedItemIds(current)) {
        await itemApi.setStatus(itemId, ItemStatus.EXCHANGED);
      }
    }
    await storage.set(STORAGE_KEYS.exchanges, nextExchanges);
    return nextExchange;
  },
};
