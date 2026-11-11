// Domain errors thrown by the server modules and turned into HTTP answers by withUser() (http.ts).

export class NotFoundError extends Error {
  constructor(what = "Not found") {
    super(what);
  }
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super("You are out of credits");
  }
}

/** 400: the input is wrong. */
export class ValidationError extends Error {}

/** 413: the upload is bigger than allowed. */
export class TooLargeError extends Error {}

/** 403: the plan doesn't allow it (e.g. more series than the plan includes). */
export class PlanLimitError extends Error {}

/** 429: too many requests of this kind for now. */
export class RateLimitedError extends Error {}
