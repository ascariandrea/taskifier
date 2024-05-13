import * as TE from 'fp-ts/TaskEither'
import { pipe } from 'fp-ts/lib/function';
import * as R from 'fp-ts/Record'
import * as IOE from 'fp-ts/IOEither'

type SyncMethod = ((...args: any) => any) | (() => any)
type AsyncMethod = ((...args: any) => Promise<any>) | (() => Promise<any>)

type Method = AsyncMethod | SyncMethod

type PromiseReturnType<T> = T extends (...args: any) => Promise<infer R> ? R : T;

type TaskifyMethod<M extends Method, E> =
  M extends AsyncMethod ?
  Parameters<M> extends [] ? () => TE.TaskEither<E, PromiseReturnType<M>> :
  (...args: Parameters<M>) => TE.TaskEither<E, PromiseReturnType<M>>
  : Parameters<M> extends [] ? () => IOE.IOEither<E, ReturnType<M>> : (...args: Parameters<M>) => IOE.IOEither<E, ReturnType<M>>

type Taskifier<I, E> = {
  [K in keyof I]:
  I[K] extends Record<string, Method> ? Taskifier<I[K], E> :
  I[K] extends Method ? TaskifyMethod<I[K], E> : never
}


const isAsyncFunction = (m: Method): m is AsyncMethod => {
  return m.constructor.name == 'AsyncFunction'
}

export const Taskifier = <I extends Record<string, Method | Record<string, Method>>, E extends Error>(impl: I, toError: (e: unknown) => E): Taskifier<I, E> => {
  return pipe(
    impl,
    R.map(method => ((...args: any[]) => {
      // transform async methods to TaskEither
      if (typeof method === 'function') {
        if (isAsyncFunction(method)) {
          return TE.tryCatch(() => method(...args), toError)
        } else {
          // transform sync methods to IOEither
          return IOE.tryCatch(() => method(...args), toError)
        }
      }
      return Taskifier(method, toError)
    }))
  ) as Taskifier<I, E>;
}

