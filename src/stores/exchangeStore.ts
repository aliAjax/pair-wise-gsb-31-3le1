import { defineStore } from 'pinia';

import { exchangeApi } from '@/api/exchangeApi';
import { ExchangeStatus } from '@/constants/exchange';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { exchangeInvolvedItemIds, isBundleExchange } from '@/models/exchange';
import { message } from '@/utils/message';

export const useExchangeStore = defineStore('exchanges', {
  state: () => ({
    exchanges: [] as Exchange[],
    statusFilter: 'all' as ExchangeStatus | 'all',
    loading: false,
  }),
  getters: {
    sent: (state) => (userId: string) => state.exchanges.filter((item) => item.from_user_id === userId),
    received: (state) => (userId: string) => state.exchanges.filter((item) => item.to_user_id === userId),
    filtered: (state) => {
      if (state.statusFilter === 'all') return state.exchanges;
      return state.exchanges.filter((item) => item.status === state.statusFilter);
    },
    /** 已被别的已同意方案占用的物品 id 集合 */
    occupiedItemIds: (state) => {
      const ids = new Set<string>();
      state.exchanges
        .filter((item) => item.status === ExchangeStatus.ACCEPTED)
        .forEach((item) => exchangeInvolvedItemIds(item).forEach((id) => ids.add(id)));
      return ids;
    },
  },
  actions: {
    async hydrate() {
      this.loading = true;
      try {
        this.exchanges = await exchangeApi.list();
      } finally {
        this.loading = false;
      }
    },
    async create(draft: ExchangeDraft) {
      const exchange = await exchangeApi.create({ ...draft, status: ExchangeStatus.PENDING });
      this.exchanges = await exchangeApi.list();
      message(isBundleExchange(exchange) ? '组合交换请求已发出，等待物主逐件确认' : '交换请求已发出', 'success');
      return exchange;
    },
    async accept(id: string) {
      const exchange = await exchangeApi.transition(id, ExchangeStatus.ACCEPTED);
      this.exchanges = await exchangeApi.list();
      message(
        isBundleExchange(exchange) ? '已整组答应，组内物品和换来的那件一起进入交换中' : '已同意交换',
        'success',
      );
    },
    async reject(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.REJECTED);
      this.exchanges = await exchangeApi.list();
      message('已拒绝交换', 'success');
    },
    async complete(id: string) {
      const exchange = await exchangeApi.transition(id, ExchangeStatus.COMPLETED);
      this.exchanges = await exchangeApi.list();
      message(
        isBundleExchange(exchange) ? '整组交换已完成，全部物品归为已交换' : '交换已完成，双方物品状态已更新',
        'success',
      );
    },
  },
});
