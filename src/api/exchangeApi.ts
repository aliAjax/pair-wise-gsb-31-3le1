import { EXCHANGE_ACTION_FLOW, ExchangeStatus, MAX_BUNDLE_ITEMS } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { FORM_MESSAGES } from '@/constants/messages';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { exchangeAllItemIds, exchangeFromItemIds, isBundleExchange } from '@/models/exchange';

import { itemApi } from './itemApi';
import { storage, STORAGE_KEYS } from '@/utils/storage';

const seedExchanges: Exchange[] = [
  {
    id: 'exchange_seed',
    from_user_id: 'user_me',
    to_user_id: 'user_lin',
    from_item_id: 'item_chair',
    from_item_ids: ['item_chair'],
    confirmed_item_ids: [],
    to_item_id: 'item_camera',
    status: ExchangeStatus.PENDING,
    message: '露营椅换拍立得，可以同城当面交换。',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'exchange_seed_bundle',
    from_user_id: 'user_chen',
    to_user_id: 'user_me',
    from_item_id: 'item_books',
    from_item_ids: ['item_books', 'item_organizer'],
    confirmed_item_ids: [],
    to_item_id: 'item_chair',
    status: ExchangeStatus.PENDING,
    message: '设计书加收纳盒换你的露营椅，周末可以约在地铁站面交。',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

/** 已被其他已同意方案占用的物品 id 集合 */
const occupiedItemIds = (exchanges: Exchange[]) => {
  const ids = new Set<string>();
  exchanges
    .filter((exchange) => exchange.status === ExchangeStatus.ACCEPTED)
    .forEach((exchange) => exchangeAllItemIds(exchange).forEach((id) => ids.add(id)));
  return ids;
};

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
    const fromIds = [...new Set(draft.from_item_ids?.length ? draft.from_item_ids : [draft.from_item_id])];
    if (!fromIds.length) throw new Error(FORM_MESSAGES.exchangeNeedSelection);
    if (fromIds.length > MAX_BUNDLE_ITEMS) throw new Error(FORM_MESSAGES.exchangeBundleLimit);

    const occupied = occupiedItemIds(exchanges);
    const unavailableTitles: string[] = [];
    const occupiedTitles: string[] = [];
    for (const itemId of fromIds) {
      const item = await itemApi.detail(itemId);
      if (item && occupied.has(itemId)) {
        occupiedTitles.push(item.title);
      } else if (!item || item.status !== ItemStatus.AVAILABLE) {
        unavailableTitles.push(item?.title ?? itemId);
      }
    }
    if (occupiedTitles.length) {
      throw new Error(`「${occupiedTitles.join('」「')}」已被其他交换方案占用，请先调整组合`);
    }
    if (unavailableTitles.length) {
      throw new Error(`「${unavailableTitles.join('」「')}」当前不可交换，请先调整组合`);
    }

    const nextExchange: Exchange = {
      ...draft,
      from_item_id: fromIds[0],
      from_item_ids: fromIds,
      confirmed_item_ids: [],
      id: storage.createId('exchange'),
      status: draft.status ?? ExchangeStatus.PENDING,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await storage.set(STORAGE_KEYS.exchanges, [nextExchange, ...exchanges]);
    return nextExchange;
  },

  async setItemConfirmed(id: string, itemId: string, confirmed: boolean): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (current.status !== ExchangeStatus.PENDING) throw new Error('当前状态不允许该操作');
    if (!exchangeFromItemIds(current).includes(itemId)) throw new Error('该物品不在这个组合里');
    const confirmedSet = new Set(current.confirmed_item_ids ?? []);
    if (confirmed) {
      confirmedSet.add(itemId);
    } else {
      confirmedSet.delete(itemId);
    }
    const nextExchange: Exchange = {
      ...current,
      confirmed_item_ids: [...confirmedSet],
      updated_at: new Date().toISOString(),
    };
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    return nextExchange;
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
      throw new Error('当前状态不允许该操作');
    }
    if (status === ExchangeStatus.ACCEPTED && isBundleExchange(current)) {
      const confirmedSet = new Set(current.confirmed_item_ids ?? []);
      const missing = exchangeFromItemIds(current).filter((itemId) => !confirmedSet.has(itemId));
      if (missing.length) throw new Error(FORM_MESSAGES.exchangeBundleNotFullyConfirmed);
    }

    const now = new Date().toISOString();
    const nextExchange: Exchange = { ...current, status, updated_at: now };
    let nextExchanges = exchanges.map((item) => (item.id === id ? nextExchange : item));

    if (status === ExchangeStatus.ACCEPTED) {
      const involvedIds = new Set(exchangeAllItemIds(current));
      for (const itemId of involvedIds) {
        await itemApi.setStatus(itemId, ItemStatus.SWAPPING);
      }
      // 盯上这些物品的其他待确认请求：标为已另行达成
      nextExchanges = nextExchanges.map((item) => {
        if (item.id === id || item.status !== ExchangeStatus.PENDING) return item;
        const touchesInvolved = exchangeAllItemIds(item).some((itemId) => involvedIds.has(itemId));
        return touchesInvolved ? { ...item, status: ExchangeStatus.SUPERSEDED, updated_at: now } : item;
      });
    }
    if (status === ExchangeStatus.COMPLETED) {
      for (const itemId of exchangeAllItemIds(current)) {
        await itemApi.setStatus(itemId, ItemStatus.EXCHANGED);
      }
    }
    await storage.set(STORAGE_KEYS.exchanges, nextExchanges);
    return nextExchange;
  },
};
