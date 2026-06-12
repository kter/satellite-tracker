import type { UserLocation } from '../types'

export class GeolocationError extends Error {}

/** Promise wrapper over the browser Geolocation API. */
export function requestLocation(timeoutMs = 10000): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeolocationError('このブラウザは位置情報に対応していません'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latDeg: pos.coords.latitude, lonDeg: pos.coords.longitude }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? '位置情報の利用が許可されませんでした'
            : '位置情報を取得できませんでした'
        reject(new GeolocationError(msg))
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 600000 },
    )
  })
}
