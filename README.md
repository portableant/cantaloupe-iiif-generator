# Simple IIIF Manifest generator

This system uses Canataloupe IIIF server, with a directus content management system, S3 buckets for images and simply generates files and serves them off gh pages.

## Build scripts

To generate the manifests run:

```
npm run generate:iiif 
```

To generate the index file run

```
npm run create:index
```

## TO DO

Add action to run this daily