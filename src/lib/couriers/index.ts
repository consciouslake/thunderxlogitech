import { InternalLogisticsClient } from "../logistics/internal";

export const getCourierClient = (name: string): InternalLogisticsClient => {
  // We're now defaulting to Internal logistics
  return new InternalLogisticsClient();
};
