# Changelog

## [Unreleased]
### Added
- `options.meta`, to merge custom `meta` to every actions unfolded
  - `options.meta.from`:
    - `true`, to add the WebSocket object
    - `false`, to not add anything into `meta`
    - otherwise, add to `meta` as-is
- `options.tags` of `string[]`, indicates what actions this bridge is interested
- `send` meta property changes, must be a string
  - [`minimatch`](https://npmjs.com/package/minimatch) against `options.tags`
  - No longer match against `options.namespace`

## [0.2.0-0] - 2018-01-25
### Added
- Action `meta` property now include `webSocket`

## [0.1.0-1] - 2017-12-31

## [0.1.0-0] - 2017-12-30

## 0.0.1-0 - 2017-12-29
### Added
- Initial public release

[Unreleased]: https://github.com/compulim/redux-websocket-bridge/compare/v0.2.0-0...HEAD
[0.2.0-0]: https://github.com/compulim/redux-websocket-bridge/compare/v0.1.0-1...v0.2.0-0
[0.1.0-1]: https://github.com/compulim/redux-websocket-bridge/compare/v0.1.0-0...v0.1.0-1
[0.1.0-0]: https://github.com/compulim/redux-websocket-bridge/compare/v0.0.1-0...v0.1.0-0
