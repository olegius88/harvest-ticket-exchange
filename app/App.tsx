import WebViewV1 from './webviews/WebViewV1.tsx';

export default function App() {
  const url2 = process.env.API_URL;
  console.log('url2=', url2);

  const url = 'http://192.168.50.84:8771/';
  // let url = 'https://example.com/?page_id=192&beta&beta2=1';
  // let url = 'https://example.com/?page_id=192';
  // if (Platform.OS === 'ios') {
  //   url = `${url}&ios_app=2`;
  // } else if (Platform.OS === 'android') {
  //   url = `${url}&android_app=2`;
  // }
  return <WebViewV1 url={url} />;
}
