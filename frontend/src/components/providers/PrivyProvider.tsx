import { PrivyProvider as PrivySDKProvider } from "@privy-io/react-auth"
import type { ReactNode } from "react"

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || ""

export function PrivyAppProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <>{children}</>
  }

  return (
    <PrivySDKProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["google", "apple", "email"],
        appearance: {
          theme: "light",
          accentColor: "#000000",
          logo: "https://assets.ns.com/Site%20Images/flag.svg",
          landingHeader: "Welcome to ns.com",
          loginMessage: "Sign in to your account to continue.",
        },
      }}
    >
      {children}
    </PrivySDKProvider>
  )
}
