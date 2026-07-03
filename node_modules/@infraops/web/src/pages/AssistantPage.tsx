import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bot, Send, BookOpen } from 'lucide-react';
import { ragQuery, type Citation } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DocumentUploadPanel } from '../components/DocumentUploadPanel';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  confidence?: number;
  intentLabel?: string;
}

const SUGGESTED = [
  'What is the lockout-tagout procedure for Substation Alpha?',
  'What are the arc flash PPE requirements?',
  'What is the project budget status for Q1 2026?',
  'What liability cap applies under the Helix Power contract?',
];

export function AssistantPage() {
  const { user } = useAuth();
  const isEngineer = user?.role === 'engineer';
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  const mutation = useMutation({
    mutationFn: (q: string) => ragQuery(q, { projectId: 'proj-substation-alpha' }),
    onSuccess: (data, q) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: q },
        {
          role: 'assistant',
          content: data.reviewRequired
            ? `${data.answer}\n\n⚠ This response was flagged for human review.`
            : data.answer,
          citations: data.citations,
          confidence: data.confidence,
          intentLabel: data.detectedIntent?.label,
        },
      ]);
      setQuestion('');
      if (data.citations[0]) setSelectedCitation(data.citations[0]);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || mutation.isPending) return;
    mutation.mutate(question.trim());
  }

  function askSuggested(q: string) {
    setQuestion(q);
    mutation.mutate(q);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-6">
      <div className="flex flex-1 flex-col">
        <header className="mb-4">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Bot className="h-7 w-7 text-accent" />
            AI Assistant
          </h1>
          <p className="mt-1 text-gray-400">Grounded answers with document citations</p>
        </header>

        {messages.length === 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => askSuggested(q)}
                className="rounded-full border border-charcoal-700 px-3 py-1.5 text-xs text-gray-400 hover:border-accent hover:text-accent"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-charcoal-700 bg-charcoal-900 p-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'ml-auto bg-accent/20 text-white'
                  : 'bg-charcoal-800 text-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.citations.map((c) => (
                    <button
                      key={c.chunkId}
                      type="button"
                      onClick={() => setSelectedCitation(c)}
                      className="rounded border border-charcoal-600 px-2 py-0.5 text-xs text-accent hover:bg-charcoal-700"
                    >
                      {c.title} (rev {c.revision})
                    </button>
                  ))}
                </div>
              )}
              {msg.confidence !== undefined && (
                <p className="mt-2 text-xs text-gray-500">
                  {msg.intentLabel && (
                    <span className="mr-2 rounded bg-charcoal-700 px-1.5 py-0.5 text-accent">
                      Intent: {msg.intentLabel}
                    </span>
                  )}
                  Confidence: {(msg.confidence * 100).toFixed(0)}%
                </p>
              )}
            </div>
          ))}
          {mutation.isPending && (
            <p className="text-sm text-gray-500">Searching documents and generating answer…</p>
          )}
          {mutation.error && (
            <p className="text-sm text-red-400">{(mutation.error as Error).message}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about substation design, safety, contracts, or project status…"
            className="flex-1 rounded-lg border border-charcoal-700 bg-charcoal-800 px-4 py-3 text-white outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={mutation.isPending || !question.trim()}
            className="rounded-lg bg-accent px-4 py-3 text-white hover:bg-accent-hover disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>

      <aside className="flex w-80 shrink-0 flex-col gap-4">
        {isEngineer && (
          <div className="rounded-xl border border-charcoal-700 bg-charcoal-900 p-4">
            <DocumentUploadPanel compact />
          </div>
        )}
        <div className="flex-1 rounded-xl border border-charcoal-700 bg-charcoal-900 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <BookOpen className="h-4 w-4 text-accent" />
            Source Preview
          </h2>
          {selectedCitation ? (
            <div>
              <p className="font-medium text-white">{selectedCitation.title}</p>
              <p className="text-xs text-gray-500">
                rev {selectedCitation.revision} · chunk {selectedCitation.chunkId}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                {selectedCitation.excerpt ?? 'No excerpt available'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Citations appear here when you ask a question. Click a source tag to preview.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
