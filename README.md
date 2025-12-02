# Mercator Shmercator

Per [xkcd](https://xkcd.com/977/).

## Development

Install dependencies:

```
npm install
```

Build the extension:

```
npm run build
```

Load the extension in your browser:

- **Chrome**: Go to `chrome://extensions`, enable Developer mode, click "Load unpacked", select this directory
- **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select `manifest.json`

## Packaging

Create a zip file for web store upload:

```
npm run package
```
