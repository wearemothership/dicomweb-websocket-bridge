# dicomweb-websocket-bridge

A proxy to forward dicomweb requests via websockets to a local server

## Description
* Handy light proxy to connect to DICOMWEB-PROXY via websockets to expose an internal PACS server to the public.  

## What is it for?

* if you want to view image data from a legacy PACS (hosted behind firewalls) without opening up ports
* the websocket proxy can be installed on any other hoster and will relay any DICOMWEB traffic to the PACS (via the DICOMWEB-PROXY plugin)

## How does it work?

* the app should be installed on a cloud server exposed
* it hosts a default DICOMweb viewer (ohif) which can be replaced
* the webserver exposes the default QIDO and WADOURI API needed for the viewer
* to be able to work it needs a local instance of DICOMWEB-PROXY running somewhere (e.g. inside hospital)
* the DICOMWEB-PROXY needs to be setup to point to the dicomweb-websocket-bridge (you probably will need a http/ws proxy to not expose it directly)
* the token configured in the DICOMWEB-PROXY client needs to match the token configured in dicomweb-websocket-bridge
* once both are running, each request will be relayed to the actual DICOMWEB-PROXY which in turn connects to the PACS to get data
* make sure to know what you are allowed to publicly expose (!)

## Setup Instructions

* clone repository and install dependencies:  
```npm install```

* update config file located in:  
```./config```

* start proxy:  
```npm start```

## License
MIT