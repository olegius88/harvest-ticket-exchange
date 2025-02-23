import React, { forwardRef, ReactElement, useRef, useState } from 'react';
import { Platform, StatusBar } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import {
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
  WebViewProgressEvent,
} from 'react-native-webview/lib/WebViewTypes';

// import OneSignal from 'react-native-onesignal';

interface WebViewV1Props {
  url: string;
}

const WebViewV1 = forwardRef<WebView, WebViewV1Props>(({ url }, ref): ReactElement => {
  const [pushProblemNoty, setPushProblemNoty] = useState<boolean>(false);
  const [curUri, setCurUri] = useState<string>(url);
  const webviewRef = useRef<WebView>(null);

  // Если требуется, можно через useImperativeHandle пробросить методы наружу
  // useImperativeHandle(ref, () => ({
  //   reload: () => webviewRef.current?.reload(),
  //   postMessage: (message: string) => webviewRef.current?.postMessage(message),
  // }));

  const sendPostResponse = (obj: ISendPostResponse): void => {
    console.log('sendPostResponse|obj=', obj);
    if (!webviewRef.current) {
      console.error('sendPostResponse|!webviewRef.current');
      return;
    }
    // obj.os = Platform.OS;
    webviewRef.current.postMessage(JSON.stringify(obj));
  };

  const onError = (error: WebViewErrorEvent): void => {
    console.log('onError|error=', error);
    // Дополнительная логика при ошибке загрузки
  };

  const tryAgain = (): void => {
    console.log('tryAgain');
    // Здесь можно добавить логику повторной загрузки страницы
  };

  const onLoad = (): void => {
    console.log('onLoad');
    // Дополнительная логика после загрузки страницы
  };

  const onHttpError = (httpError: WebViewHttpErrorEvent): void => {
    // console.log('onHttpError|httpError=', httpError);
    // Обработка HTTP-ошибок, если необходимо
  };

  const onLoadStart = async (event: WebViewNavigation): Promise<void> => {
    // console.log('onLoadStart|event=', event);
    // Можно добавить дополнительную логику при начале загрузки
  };

  const onLoadEnd = (): void => {
    console.log('onLoadEnd: ');
    // Дополнительная логика после завершения загрузки
  };

  const onFileDownload = (nativeEvent: any): void => {
    console.log('onFileDownload');
    // Логика обработки скачивания файлов
  };

  const onNavigationStateChange = (newNavState: WebViewNavigation): void => {
    console.log('onNavigationStateChange|newNavState.url=', newNavState.url);
    if (newNavState.url) {
      const urlStr = newNavState.url;
      const urlInclude = urlStr.includes('https://example.com/?page_id=192');
      if (!urlInclude) {
        // Если URL не содержит требуемый адрес — перенаправляем
        setCurUri('https://example.com/?page_id=192');
      }
    }
  };

  const loadProgress = async (event: WebViewProgressEvent): Promise<void> => {
    console.log('loadProgress');
    // При необходимости можно реализовать логику отображения прогресса загрузки
  };

  const onMessage = async (event: WebViewMessageEvent): Promise<void> => {
    console.log('onMessage');

    if (!event || !event.nativeEvent || !event.nativeEvent.data) {
      console.log({ event });
      console.log('nativeEvent: ', event.nativeEvent);
      console.log('data: ', event.nativeEvent.data);
      return;
    }
    const nativeEventData = event.nativeEvent.data;

    let eventData: any;
    try {
      eventData = JSON.parse(nativeEventData);
    } catch (error) {
      console.error('onMessage|JSON.parse|error=', error);
      console.error('onMessage|JSON.parse|nativeEventData=', nativeEventData);
      return;
    }
    console.log('onMessage|eventData=', eventData);
    if (!eventData) {
      console.error('onMessage|eventData|!eventData|eventData=', eventData);
      return;
    }

    const { req, reqId } = eventData;

    if (!req?.type) {
      console.error('onMessage|!req?.mode|req=', req);
      return;
    }
    console.log('onMessage|req?.mode=', req.mode);

    switch (req.type) {
      case 'registration': {
        console.log('onMessage|registration|req.data=', req.data);
        sendPostResponse({
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: {
            mode: 'registration',
            userId: 'userId',
          } as ISendPostResponseRegistration,
        });
        return;
      }
      case 'getPushToken': {
        sendPostResponse({
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          res: {
            mode: 'getPushToken',
            pushUserId: 'deviceState.userId',
            pushToken: 'deviceState.pushToken',
          } as ISendPostResponsePushToken,
        });
        return;
      }
      default:
        console.error('onMessage|eventData|switch|default|eventData=', eventData);
    }
  };

  const getHeadMarginTop = (): number => {
    if (Platform.OS === 'ios') {
      if (StatusBar.currentHeight) {
        return StatusBar.currentHeight;
      }
      return 40;
    }
    return 0;
  };

  console.log('StatusBar.currentHeight=', StatusBar.currentHeight, getHeadMarginTop());
  console.log('WebViewV1|url=', curUri);

  return (
    <WebView
      ref={(instance) => {
        webviewRef.current = instance;
        if (typeof ref === 'function') {
          ref(instance);
        } else if (ref) {
          (ref as React.MutableRefObject<WebView | null>).current = instance;
        }
      }}
      source={{ uri: curUri }}
      allowFileAccess={true}
      allowFileAccessFromFileURLs={true}
      allowUniversalAccessFromFileURLs={true}
      startInLoadingState={true}
      mixedContentMode="compatibility"
      javaScriptEnabled={true}
      domStorageEnabled={true}
      onError={onError}
      onLoad={onLoad}
      onHttpError={onHttpError}
      // onLoadStart={onLoadStart}
      onLoadEnd={onLoadEnd}
      // onNavigationStateChange={onNavigationStateChange}
      onFileDownload={onFileDownload}
      onMessage={onMessage}
      onLoadProgress={loadProgress}
      userAgent={'TalonKombainera-' + Platform.OS}
      style={{ marginTop: getHeadMarginTop() }}
      sharedCookiesEnabled={true}
      thirdPartyCookiesEnabled={true}
      useWebKit
      // decelerationRate="normal"
      onContentSizeChange={() => {
        console.log('onContentSizeChange');
      }}
      onRenderProcessGone={() => {
        console.log('onRenderProcessGone');
      }}
    />
  );
});

export default WebViewV1;
