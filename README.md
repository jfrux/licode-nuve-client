# Nuve Client JS
## Installation for Node
```
npm install licode-nuve-client
```
## Installation for Browser
```
bower install licode-nuve-client
```

## Different Distribution Files
In the `dist` directory there are several files.
`nuve.all.js` is the uncompressed / unminified version that includes vendor files
`nuve.js` is the uncompressed / unminified version of the nuve client.


## Development
Only needs done if there are changes to the licode nuveClient repo.
```
git clone https://github.com/joshuairl/licode-nuve-client.git #clones this repo
cd licode-nuve-client
npm install # Installs build tools.
npm install grunt-cli -g # if you don't already have it
grunt update && grunt build
```
