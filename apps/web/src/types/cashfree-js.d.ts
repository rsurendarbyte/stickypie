declare module "@cashfreepayments/cashfree-js" {
  export type CashfreeCheckoutOptions = {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_blank" | "_top" | "_modal" | HTMLElement;
  };

  export type CashfreeInstance = {
    checkout(options: CashfreeCheckoutOptions): Promise<unknown>;
  };

  export function load(options: {
    mode: "sandbox" | "production";
  }): Promise<CashfreeInstance>;
}
