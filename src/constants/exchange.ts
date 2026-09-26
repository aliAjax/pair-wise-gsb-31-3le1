export enum ExchangeStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  SUPERSEDED = 'superseded',
  COMPLETED = 'completed',
}

/** 一次组合交换最多可以勾选的自己的物品件数 */
export const MAX_BUNDLE_ITEMS = 3;

export const EXCHANGE_STATUS_OPTIONS = [
  { label: '待确认', value: ExchangeStatus.PENDING },
  { label: '已同意', value: ExchangeStatus.ACCEPTED },
  { label: '已拒绝', value: ExchangeStatus.REJECTED },
  { label: '已另行达成', value: ExchangeStatus.SUPERSEDED },
  { label: '已完成', value: ExchangeStatus.COMPLETED },
];

export const EXCHANGE_ACTION_FLOW: Record<ExchangeStatus, ExchangeStatus[]> = {
  [ExchangeStatus.PENDING]: [ExchangeStatus.ACCEPTED, ExchangeStatus.REJECTED],
  [ExchangeStatus.ACCEPTED]: [ExchangeStatus.COMPLETED],
  [ExchangeStatus.REJECTED]: [],
  [ExchangeStatus.SUPERSEDED]: [],
  [ExchangeStatus.COMPLETED]: [],
};

export const EXCHANGE_STORAGE_HINTS = {
  statusKey: 'reswap:exchanges',
  statusTouchedBy: ['models/exchange.ts', 'stores/exchangeStore.ts', 'components/common/ExchangeCard.vue'],
};
