// Should NOT rewrite: package exports './parse' but not './parse/index.js'
import { parse } from 'date-fns/parse';
