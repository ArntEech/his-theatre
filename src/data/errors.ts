/** An error whose message is written for the person using the app. Screens show it as-is. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}
