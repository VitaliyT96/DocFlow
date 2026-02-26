import { fetchServerGraphql } from '@/lib/server-api';
import { redirect } from 'next/navigation';
import Link from 'next/link';

interface DocumentType {
  id: string;
  title: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export default async function DashboardPage() {
  let documents: DocumentType[] = [];
  
  try {
    const data = await fetchServerGraphql<{ documents: DocumentType[] }>(`
      query GetUserDocuments {
        documents {
          id
          title
          status
          createdAt
        }
      }
    `);
    documents = data.documents;
  } catch {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <button className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">Upload New</button>
        </header>

        <main className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <li key={doc.id} className="p-4 hover:bg-slate-50 transition-colors">
                <Link href={`/documents/${doc.id}`} className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-slate-900">{doc.title}</h3>
                    <p className="text-sm text-slate-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full 
                    ${doc.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : ''}
                    ${doc.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700' : ''}
                    ${doc.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${doc.status === 'FAILED' ? 'bg-red-100 text-red-700' : ''}
                  `}>
                    {doc.status}
                  </span>
                </Link>
              </li>
            ))}
            {documents.length === 0 && (
              <li className="p-8 text-center text-slate-500">No documents found. Upload one to get started.</li>
            )}
          </ul>
        </main>
      </div>
    </div>
  );
}
