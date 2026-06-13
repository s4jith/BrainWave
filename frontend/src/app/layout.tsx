import type { Metadata } from "next";
import "@styles/globals.css";
import { AppProviders } from "@providers/AppProviders";
import { TokenValidator } from "@features/auth/components/TokenValidator";
import { GlobalWatermark } from "@components/common/GlobalWatermark";

export const metadata: Metadata = {
  title: "Brainwave",
  description: "Smarter learning, synchronized.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <TokenValidator>
            <div className="flex min-h-screen flex-col">
              <div className="flex-1">{children}</div>
              <GlobalWatermark />
            </div>
          </TokenValidator>
        </AppProviders>
      </body>
    </html>
  );
}
