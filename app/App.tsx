// app/App.tsx
import React from 'react';
import WebViewV1 from './webviews/WebViewV1';

export default function App() {
  // const url = process.env.API_URL;
  const url = process.env.API_URL || 'file:///android_asset/web/index.html';
  // const url = 'http://192.168.50.84:8771/';
  // let url = 'https://example.com/?page_id=192&beta&beta2=1';
  // let url = 'https://example.com/?page_id=192';
  // if (Platform.OS === 'ios') {
  //   url = `${url}&ios_app=2`;
  // } else if (Platform.OS === 'android') {
  //   url = `${url}&android_app=2`;
  // }
  console.log('process.env.API_URL=',  process.env.API_URL);
  console.log('url=', url);
  return <WebViewV1 url={url} />;
}
