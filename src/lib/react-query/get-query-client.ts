import { environmentManager, QueryClient } from "@tanstack/react-query"

const defaultStaleTime = 60_000
let browserQueryClient: QueryClient | undefined

const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: defaultStaleTime,
      },
    },
  })
}

export const getQueryClient = () => {
  if (environmentManager.isServer()) {
    return makeQueryClient()
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }

  return browserQueryClient
}
