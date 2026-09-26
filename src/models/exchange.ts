import { ExchangeStatus } from '@/constants/exchange';

export interface Exchange {
  id: string;
  from_user_id: string;
  to_user_id: string;
  /** 主拿出物品（旧单件请求字段，组合请求时取 from_item_ids 的第一件） */
  from_item_id: string;
  to_item_id: string;
  /** 组合交换：发起时勾选的全部物品（1~3 件）；旧单件请求没有该字段 */
  from_item_ids?: string[];
  /** 组合交换：物主已逐件确认的物品 id；旧单件请求没有该字段 */
  confirmed_item_ids?: string[];
  status: ExchangeStatus;
  message: string;
  created_at: string;
  updated_at: string;
}

export type ExchangeDraft = Omit<
  Exchange,
  'id' | 'status' | 'created_at' | 'updated_at' | 'confirmed_item_ids'
> & {
  status?: ExchangeStatus;
  confirmed_item_ids?: string[];
};

/** 拿出的全部物品 id（兼容没有 from_item_ids 的旧单件请求） */
export const exchangeFromItemIds = (exchange: Pick<Exchange, 'from_item_id' | 'from_item_ids'>): string[] =>
  exchange.from_item_ids?.length ? exchange.from_item_ids : [exchange.from_item_id];

/** 该交换涉及的全部物品（拿出的一组 + 换取的那件） */
export const exchangeAllItemIds = (exchange: Pick<Exchange, 'from_item_id' | 'from_item_ids' | 'to_item_id'>): string[] => [
  ...exchangeFromItemIds(exchange),
  exchange.to_item_id,
];

/** 是否为多件组合交换（单件请求照旧走单件处理流程） */
export const isBundleExchange = (exchange: Pick<Exchange, 'from_item_id' | 'from_item_ids'>): boolean =>
  exchangeFromItemIds(exchange).length > 1;
