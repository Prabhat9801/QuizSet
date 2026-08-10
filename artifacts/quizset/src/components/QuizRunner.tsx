import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Clock3, Flag, Send } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { Question } from '@/types';
import { formatTimer } from '@/lib/format';

/**
 * Untimed, immediate-feedback mode — every course's practice system runs on
 * this: no forced timer, correctness revealed the instant an option is
 * picked, then a Next button. This is the ONLY runner a course attempt ever
 * uses — a course has no timed "type" of its own; a timed, scheduled,
 * one-shot experience is what LiveTest (and TimedQuizRunner below) is for.
 */
export function PracticeQuizRunner({ title, questions, onFinish }: { title: string; questions: Question[]; onFinish: (answers: Record<number, number>, timeTakenSeconds: number) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const startRef = useRef(Date.now());
  const q = questions[index];
  const locked = answers[index] !== undefined;
  const finish = () => onFinish(answers, Math.round((Date.now() - startRef.current) / 1000));

  return (
    <div className="exam-interface">
      <div className="exam-top">
        <div>
          <h1>{title}</h1>
          <p>
            Question {index + 1} of {questions.length} · untimed
          </p>
        </div>
      </div>
      <div className="content">
        <Card>
          <div className="question-number">
            {q.topic.toUpperCase()} · {q.difficulty.toUpperCase()}
          </div>
          <h2 className="question-text">{q.text}</h2>
          {q.options.map((o, i) => {
            let cls = 'question-option';
            if (locked) {
              if (i === q.answer) cls += ' correct';
              else if (i === answers[index]) cls += ' wrong';
            } else if (answers[index] === i) cls += ' selected';
            return (
              <button key={i} className={cls} disabled={locked} onClick={() => setAnswers({ ...answers, [index]: i })}>
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                {o}
                {locked && i === q.answer && <Check size={15} />}
              </button>
            );
          })}
          {locked && (
            <div className="explanation">
              <b>{answers[index] === q.answer ? 'Correct!' : 'Not quite'}</b>
              <p>{q.explanation}</p>
            </div>
          )}
          <div className="form-actions">
            {index === questions.length - 1 ? (
              <Button disabled={!locked} onClick={finish}>
                Finish practice <ArrowRight size={14} />
              </Button>
            ) : (
              <Button disabled={!locked} onClick={() => setIndex(index + 1)}>
                Next question <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * Timed, no-feedback-until-submit mode — question palette, mark-for-review,
 * auto-submit at zero. Used exclusively by Live Tests (a scheduled,
 * timed, one-shot event) — never by a course's own practice attempts,
 * which always run through PracticeQuizRunner above.
 */
export function TimedQuizRunner({ title, questions, totalSeconds, onSubmit }: { title: string; questions: Question[]; totalSeconds: number; onSubmit: (answers: Record<number, number>, timeTakenSeconds: number) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [review, setReview] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [confirm, setConfirm] = useState(false);
  const submittedRef = useRef(false);
  const startRef = useRef(Date.now());

  const submit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(answers, Math.round((Date.now() - startRef.current) / 1000));
  };

  useEffect(() => {
    if (secondsLeft <= 0) {
      submit();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const q = questions[index];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="exam-interface">
      <div className="exam-top">
        <div>
          <h1>{title}</h1>
          <p>
            {index + 1} / {questions.length} questions
          </p>
        </div>
        <div className="timer">
          <Clock3 size={14} /> {formatTimer(Math.max(0, secondsLeft))}
        </div>
      </div>
      <div className="content">
        <div className="exam-progress">
          <div style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
        </div>
        <div className="question-layout">
          <Card>
            <div className="question-number">
              QUESTION {index + 1} / {questions.length}
            </div>
            <h2 className="question-text">{q.text}</h2>
            {q.options.map((o, i) => (
              <button className={`question-option ${answers[index] === i ? 'selected' : ''}`} key={i} onClick={() => setAnswers({ ...answers, [index]: i })}>
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                {o}
              </button>
            ))}
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setReview(review.includes(index) ? review.filter((x) => x !== index) : [...review, index])}>
                <Flag size={14} /> {review.includes(index) ? 'Remove review' : 'Mark for review'}
              </Button>
              <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                Previous
              </Button>
              <Button onClick={() => (index === questions.length - 1 ? setConfirm(true) : setIndex(index + 1))}>
                Save & next <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
          <Card>
            <div className="card-title">
              <div>
                <h2>Question palette</h2>
                <p>
                  {answeredCount} answered · {review.length} review
                </p>
              </div>
            </div>
            <div className="palette">
              {questions.map((_, i) => (
                <button key={i} className={`${i === index ? 'current ' : ''}${answers[i] !== undefined ? 'answered ' : ''}${review.includes(i) ? 'review' : ''}`} onClick={() => setIndex(i)}>
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="palette-legend">
              <span>
                <i className="answered-dot" /> Answered
              </span>
              <span>
                <i className="review-dot" /> Review
              </span>
              <span>
                <i className="empty-dot" /> Not attempted
              </span>
            </div>
            <Button className="submit-exam" onClick={() => setConfirm(true)}>
              Submit <Send size={14} />
            </Button>
          </Card>
        </div>
      </div>
      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Submit now?</h3>
            </div>
            <p className="modal-copy">You can continue reviewing your answers, or submit now to see your result.</p>
            <div className="submit-stats">
              <div>
                <b>{answeredCount}</b>
                <small>Answered</small>
              </div>
              <div>
                <b>{questions.length - answeredCount}</b>
                <small>Not answered</small>
              </div>
              <div>
                <b>{review.length}</b>
                <small>Review</small>
              </div>
            </div>
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Continue
              </Button>
              <Button onClick={submit}>Submit</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
