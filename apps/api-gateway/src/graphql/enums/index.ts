// Side-effect imports: calling registerEnumType() on module load.
// Import this barrel in the GraphQL module to ensure enums are registered
// before Apollo builds the schema.
import './document-status.enum';
import './processing-job-status.enum';
