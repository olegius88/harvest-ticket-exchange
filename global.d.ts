export interface ISendPostResponsePushToken {
  mode: 'getPushToken';
  pushUserId: string;
  pushToken: string;
}
export interface ISendPostResponseRegistration {
  mode: 'registration';
  userId: string;
}
export interface ISendPostResponse {
  reqId: string;
  type: 'sendPostResponse';
  resType: 'reject' | 'resolve';
  res: ISendPostResponsePushToken | ISendPostResponseRegistration;
}

export interface IPostMessageCallback {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
  timerId: NodeJS.Timeout;
}
