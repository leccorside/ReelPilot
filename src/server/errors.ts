// Domain errors thrown by the server modules and turned into HTTP answers by the routes.

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

export class ValidationError extends Error {}
