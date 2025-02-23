interface ISendPostResponsePushToken {
  mode: 'getPushToken';
  pushUserId: string;
  pushToken: string;
}
interface ISendPostResponseRegistration {
  mode: 'registration';
  userId: string;
}
interface ISendPostResponse {
  reqId: string;
  type: 'sendPostResponse';
  resType: 'reject' | 'resolve';
  res: ISendPostResponsePushToken | ISendPostResponseRegistration;
}
