# Simple IIIF Manifest generator

This system uses Canataloupe IIIF server, with a directus content management system, S3 buckets for images and simply generates files and serves them off gh pages.

## Build scripts

To generate the manifests run:

```
npm run generate:iiif 
```
OR

```
npm run annotations
```

To generate the index file run

```
npm run create:index
```

This creates a paginated index of all the manifests, link to a demo using clover IIIF engine, whether there's any annotations and the file size and date of generation.

## CI

A simple action can be triggered to build these or it runs once a week based on cron.
