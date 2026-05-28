/**
 * server-only 의존 없는 순수 타입 모듈.
 * RSC와 client(또는 jsdom 테스트) 양쪽에서 import 가능하도록 분리.
 */
export interface AdminStatus {
  isAdmin: boolean
  userId: string | null
  email: string | null
}
