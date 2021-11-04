# CSV importing

One of the benefits of ledg is that once the software shares responsibility of
maintaining journal files, the same piece of software can provide a canonical
way of importing and writing data.

The folder contains two examples. The first set are files with prefixes
`example*` and `output*`. A more complicated parser file is shown in
`example2.parser.js`.

It is also helpful to explore the implementation of macro functions used in
parser code. They are defined in
[lib/core/csv/import.js](../../lib/core/csv/import.js).
