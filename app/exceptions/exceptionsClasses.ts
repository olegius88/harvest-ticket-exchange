enum ErrorTypes {
  ValidationError = 'ValidationError',
  AuthorizationError = 'AuthorizationError',
  NotFoundError = 'NotFoundError',
  SendError = 'SendError',
}

export class AppError extends Error {
  name: ErrorTypes;
  constructor(name: ErrorTypes, message: string) {
    super(message);
    this.name = name;
  }
}
export class FrontError extends Error {
  name: ErrorTypes;
  constructor(name: ErrorTypes, message: string) {
    super(message);
    this.name = name;
  }
}

export class NotFoundError extends AppError {
  constructor(errorMsg: string) {
    super(ErrorTypes.NotFoundError, errorMsg);
  }
}

export class VoidAndNotError extends AppError {
  constructor(errorMsg: string) {
    super(ErrorTypes.NotFoundError, errorMsg);
  }
}

export class SendError extends AppError {
  constructor(errorMsg: string) {
    super(ErrorTypes.SendError, errorMsg);
  }
}
