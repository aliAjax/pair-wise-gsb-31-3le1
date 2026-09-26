import { ExchangeStatus } from '@/constants/exchange';

export interface Exchange {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_item_id: string;
  /** 组合交换：发起方一次拿出的物品（1-3 件）。旧单件请求没有该字段，回退读 from_item_id */
  from_item_ids?: string[];
  to_item_id: string;
  status: ExchangeStatus;
  message: string;
  created_at: string;
  updated_at: string;
}

export type ExchangeDraft = Omit<Exchange, 'id' | 'status' | 'created_at' | 'updated_at'> & {
  status?: ExchangeStatus;
};

type ExchangeItemRef = Pick<Exchange, 'from_item_id' | 'from_item_ids'>;

/** 发起方拿出的物品列表：组合交换读 from_item_ids，旧单件请求回退 from_item_id */
export const exchangeFromItemIds = (exchange: ExchangeItemRef): string[] =>
  exchange.from_item_ids?.length ? exchange.from_item_ids : [exchange.from_item_id];

/** 整组涉及的所有物品 id（拿出的 + 换来的那件） */
export const exchangeInvolvedItemIds = (exchange: ExchangeItemRef & Pick<Exchange, 'to_item_id'>): string[] => [
  ...exchangeFromItemIds(exchange),
  exchange.to_item_id,
];

/** 是否组合交换（一次拿出多件） */
export const isBundleExchange = (exchange: ExchangeItemRef): boolean => exchangeFromItemIds(exchange).length > 1;
