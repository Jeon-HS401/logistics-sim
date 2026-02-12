/**
 * 시장 데이터 — data/markets.json 기반
 * item_id는 레시피/품목과 동일한 명칭 사용 (치유캡슐→메밀꽃 캡슐, 통조림→시트론 통조림 등)
 */

import marketsJson from '../../data/markets.json'

export interface MarketItemOffer {
  item_id: string
  price: number
}

export interface MarketSpec {
  market_id: string
  recovery_per_hour: number
  max_balance: number
  items: MarketItemOffer[]
}

const json = marketsJson as { markets: MarketSpec[] }
export const MARKETS: MarketSpec[] = json.markets

export function getMarketByMarketId(market_id: string): MarketSpec | undefined {
  return MARKETS.find((m) => m.market_id === market_id)
}
