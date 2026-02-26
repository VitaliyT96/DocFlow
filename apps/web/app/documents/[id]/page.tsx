import { fetchServerGraphql } from '@/lib/server-api';
import { DocumentWorkspace, DocumentData } from './DocumentWorkspace';
import { redirect } from 'next/navigation';

export default async function DocumentDetailServerPage({ params }: { params: { id: string } }) {
  const { id } = params;
  
  let documentData: DocumentData | null = null;
  
  try {
    const data = await fetchServerGraphql<{ document: DocumentData }>(`
      query GetDocument($id: String!) {
        document(id: $id) {
          id
          title
          status
          content
        }
      }
    `, { id });
    
    documentData = data.document;
  } catch {
    redirect('/dashboard');
  }

  if (!documentData) {
    return <div className="p-8 text-center">Document not found</div>;
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      <DocumentWorkspace initialDocument={documentData} />
    </div>
  );
}
