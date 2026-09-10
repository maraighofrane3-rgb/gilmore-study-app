import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  X,
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Home,
  Sparkles,
  CheckCircle,
  Timer,
  Target,
  BookOpen,
  FileText,
  Compass,
  Feather,
  Trophy,
  Palette,
  Bell,
  PlusCircle,
  Save,
  Trash2,
  Pencil,
  Upload,
  RefreshCw,
  Search,
  PlayCircle,
  MessageCircle,
  RotateCcw,
} from 'lucide-react';

const CHAPTERS = [
  {
    icon: GraduationCap,
    title: 'Welcome to Your Study Sanctuary',
    intro:
      'This guide will walk you through every important part of the site, including the simple buttons. Think of it as your first tour through an old library: every door, drawer, shelf and lamp has a purpose.',
    sections: [
      {
        heading: 'What this app is for',
        items: [
          'Plan your studies with goals and tasks.',
          'Focus using timed study sessions.',
          'Track books and study materials.',
          'Use AI to summarize, explain and explore ideas.',
          'Reflect through notes, rabbit holes and progress tracking.',
        ],
      },
      {
        heading: 'How to use the guide',
        items: [
          'Use Next Chapter to continue.',
          'Use Back to reread a previous explanation.',
          'Use Skip Tour if you already know your way.',
          'You can replay this guide later from the sidebar Guide button.',
        ],
      },
    ],
  },

  {
    icon: Home,
    title: 'Dashboard — Your Main Desk',
    intro:
      'The Dashboard is the first page you see. It gives you a quick view of your study life: mentor message, tasks, goals, progress, focus stats and quick actions.',
    sections: [
      {
        heading: 'What you see here',
        items: [
          'Daily Mentor: a warm study message that changes four times a day.',
          'Today’s tasks: your immediate work for the day.',
          'Goal Zone: a quick preview of your active goals.',
          'Progress cards: books, focus time, streaks or achievements depending on your setup.',
          'Quick action buttons: shortcuts to resume studying, start focus mode or create something new.',
        ],
      },
      {
        heading: 'Simple buttons',
        items: [
          'Refresh icon: asks for a new Daily Mentor message if you want another reflection.',
          'Create your first goal: opens the Goals page so you can start a long-term plan.',
          'Resume: returns you to the last study material or chapter you were working on.',
          'View all / See more: opens the full page for that section.',
        ],
      },
    ],
  },

  {
    icon: Sparkles,
    title: 'Daily Mentor — Four Rituals a Day',
    intro:
      'The Daily Mentor is your small academic companion. It is not supposed to change every time you refresh. It follows the rhythm of the day.',
    sections: [
      {
        heading: 'How it works',
        items: [
          'Morning message: appears from around 5 AM to noon.',
          'Noon message: appears from noon to late afternoon.',
          'Evening message: appears as the day winds down.',
          'Night message: appears late at night and continues after midnight.',
        ],
      },
      {
        heading: 'Buttons',
        items: [
          'Refresh button: manually requests a new message for the current time period.',
          'If you do not press refresh, the same message stays during that period.',
          'The message is cached, so it appears quickly when you reload the page.',
        ],
      },
    ],
  },

  {
    icon: CheckCircle,
    title: 'Tasks — Your Daily To-Do List',
    intro:
      'The Tasks page is for simple daily work. Use it for assignments, reading targets, revision sessions, chores, or any small action you want to complete.',
    sections: [
      {
        heading: 'Main functions',
        items: [
          'Add a task when you need to remember something.',
          'Mark a task as completed when it is done.',
          'Keep unfinished tasks visible so you know what still needs attention.',
          'Use tasks as small stepping stones toward larger goals.',
        ],
      },
      {
        heading: 'Buttons and controls',
        items: [
          'Add / Plus button: creates a new task.',
          'Checkbox: marks the task as done or undone.',
          'Delete / trash button: removes a task permanently.',
          'Input field: where you write the task title.',
          'Save button, if present: confirms the task after editing.',
        ],
      },
    ],
  },

  {
    icon: Timer,
    title: 'Focus — Pomodoro and Deep Work',
    intro:
      'The Focus page helps you study in timed sessions. It is your quiet desk timer: choose a duration, start the session and protect your attention.',
    sections: [
      {
        heading: 'Main functions',
        items: [
          'Start a focus session when you want uninterrupted study time.',
          'Choose a duration such as 25, 45 or 60 minutes depending on your energy.',
          'Track completed focus sessions.',
          'Connect focus time to your progress and achievements.',
        ],
      },
      {
        heading: 'Buttons and controls',
        items: [
          'Start / Play button: begins the timer.',
          'Pause button: temporarily stops the timer without resetting it.',
          'Reset button: returns the timer to the beginning.',
          'Duration buttons: choose how long the session should be.',
          'Task selector, if present: lets you focus on a specific task.',
          'Complete session button, if present: saves the finished focus session.',
        ],
      },
    ],
  },

  {
    icon: Target,
    title: 'Goals — The Syllabus',
    intro:
      'Goals are for long-term learning plans. If tasks are today’s pages, goals are the full syllabus. Use this page for exams, books, courses, projects or personal ambitions.',
    sections: [
      {
        heading: 'Main functions',
        items: [
          'Create a large goal, such as “Finish biology revision” or “Read 12 books”.',
          'Break each goal into smaller goal tasks.',
          'Track progress automatically as you complete the small tasks.',
          'Open a goal to see its details and manage its steps.',
        ],
      },
      {
        heading: 'Buttons and controls',
        items: [
          'Create Goal: adds a new long-term goal.',
          'Add Task inside a goal: creates a smaller step for that goal.',
          'Checkbox: marks a goal task as completed.',
          'Progress bar: shows how much of the goal is finished.',
          'Edit / pencil button: changes the title, description or details.',
          'Delete / trash button: removes a goal or task.',
          'Back button: returns from a goal detail view to the full goals list.',
        ],
      },
    ],
  },

  {
    icon: BookOpen,
    title: 'Library — Your Reading Shelf',
    intro:
      'The Library is where you track books. It is for novels, textbooks, research books, essays or anything you want to read and remember.',
    sections: [
      {
        heading: 'Main functions',
        items: [
          'Add books you want to read, are currently reading or have finished.',
          'Track current page and total pages.',
          'Move books between Want to Read, Reading and Read.',
          'Attach a PDF when you want AI help or text extraction.',
          'Open a book to see its detailed reading view.',
        ],
      },
      {
        heading: 'Buttons and controls',
        items: [
          'Add Book: creates a new book entry.',
          'Edit / pencil button: fixes title, author, page count or status.',
          'Delete / trash button: removes the book from your library.',
          'Upload PDF: attaches a PDF file to the book.',
          'Remove PDF: deletes the attached PDF without deleting the book.',
          'Save progress: stores your current page.',
          '+10 button, if present: quickly moves your reading progress forward.',
          'Finished button: marks the book as completed.',
          'Back button: returns to the library grid.',
        ],
      },
    ],
  },

  {
    icon: FileText,
    title: 'Study Materials — Courses, PDFs and Chapters',
    intro:
      'Study Materials are for structured academic content. Unlike the Library, which is book-centered, this area is chapter-centered and works well for classes, modules and PDFs.',
    sections: [
      {
        heading: 'Main functions',
        items: [
          'Create a study material, such as a course, subject or PDF.',
          'Add chapters inside each material.',
          'Upload or extract text from PDFs.',
          'Open a chapter to study it with AI tools.',
          'Resume your latest chapter from the Dashboard.',
        ],
      },
      {
        heading: 'Buttons and controls',
        items: [
          'Add Material: creates a new subject or study container.',
          'Add Chapter: creates a chapter inside the selected material.',
          'Upload button: attaches a PDF file.',
          'Extract Text: reads text from the PDF so the AI can use it.',
          'Chevron / open button: enters a material or chapter.',
          'Back button: returns to the previous list.',
          'Delete button: removes a material or chapter.',
        ],
      },
    ],
  },

  {
    icon: MessageCircle,
    title: 'Chapter AI Assistant — Summaries, Explanations and Quizzes',
    intro:
      'Inside a chapter, the AI assistant helps you understand the material. You can ask it to summarize, explain, list key points or create quiz questions.',
    sections: [
      {
        heading: 'Main functions',
        items: [
          'Summarize a full chapter or selected page range.',
          'Explain difficult content in simpler language.',
          'Generate key points for revision.',
          'Create quiz questions to test yourself.',
          'Save useful AI responses into your notes.',
        ],
      },
      {
        heading: 'Buttons and controls',
        items: [
          'Summarize: creates a shorter version of the text.',
          'Explain Simply: explains the content as if you are learning it for the first time.',
          'Key Points: extracts the most important ideas.',
          'Quiz: generates questions for active recall.',
          'From Page / To Page fields: limit the AI to a specific page range.',
          'Save Note: saves the AI result to your notes.',
          'Send button: sends a custom question to the AI chat.',
          'Clear / X button, if present: clears the current result or closes a panel.',
        ],
      },
    ],
  },

  {
    icon: Compass,
    title: 'Rabbit Holes — Structured Curiosity',
    intro:
      'Rabbit Holes are for questions that pull at your sleeve. Instead of losing yourself randomly online, this page turns curiosity into a structured exploration.',
    sections: [
      {
        heading: 'Main functions',
        items: [
          'Start with a question or topic you are curious about.',
          'Let the AI generate a guided exploration.',
          'Discover related concepts, sources and follow-up questions.',
          'Save the exploration so you can return to it later.',
        ],
      },
      {
        heading: 'Buttons and controls',
        items: [
          'New Rabbit Hole: starts a new exploration.',
          'Generate: asks the AI to create the research path.',
          'Open / view button: reads a saved rabbit hole.',
          'Delete button: removes an exploration.',
          'Save button: keeps the generated result in your account.',
        ],
      },
    ],
  },

  {
    icon: Feather,
    title: 'Notebook — Your Commonplace Book',
    intro:
      'The Notebook is for thoughts, reflections, quotes, class notes and ideas. It is your private academic journal.',
    sections: [
      {
        heading: 'Main functions',
        items: [
          'Create notes for anything you want to remember.',
          'Write reflections after study sessions.',
          'Save quotes, ideas and summaries.',
          'Use tags or categories if your version includes them.',
          'Return later to review your thinking.',
        ],
      },
      {
        heading: 'Buttons and controls',
        items: [
          'New Note: creates a blank note.',
          'Save: stores your writing.',
          'Edit / pencil button: changes an existing note.',
          'Delete / trash button: removes a note.',
          'Search field: finds notes by title or content.',
          'Tag/category selector, if present: organizes notes by topic.',
        ],
      },
    ],
  },

  {
    icon: Trophy,
    title: 'Progress and Achievements',
    intro:
      'The Progress area makes your quiet work visible. It turns effort into patterns: streaks, completed tasks, focus hours, finished books and badges.',
    sections: [
      {
        heading: 'Main functions',
        items: [
          'See how consistently you are studying.',
          'Track focus time over days or weeks.',
          'View completed books, tasks and goals.',
          'Earn achievements for milestones.',
          'Use progress as encouragement, not pressure.',
        ],
      },
      {
        heading: 'Buttons and controls',
        items: [
          'Weekly / monthly filters, if present: change the time period shown.',
          'Achievement cards: show what you have earned or what is still locked.',
          'Refresh button, if present: updates your stats.',
          'Chronicle / weekly report button, if present: opens a reflective summary of your week.',
        ],
      },
    ],
  },

  {
    icon: Palette,
    title: 'Settings — Make the Place Yours',
    intro:
      'Settings control your profile, theme, notifications and study preferences. This is where the app becomes your own room.',
    sections: [
      {
        heading: 'Main functions',
        items: [
          'Update your profile details.',
          'Choose a visual theme.',
          'Turn study reminders on or off.',
          'Change Pomodoro preferences if available.',
          'Control privacy or account settings.',
        ],
      },
      {
        heading: 'Buttons and controls',
        items: [
          'Theme buttons: switch between visual styles such as Paper, Midnight, Library, Cream or Harvard.',
          'Study Reminders toggle: asks your browser for permission to show notifications.',
          'Email notifications toggle: only works if an email backend is set up.',
          'Save Changes: stores your updated settings.',
          'Logout: signs you out of the app.',
        ],
      },
    ],
  },

  {
    icon: Bell,
    title: 'Notifications — Browser Alerts',
    intro:
      'Study reminders are browser notifications. They appear only if your browser allows them.',
    sections: [
      {
        heading: 'How they work',
        items: [
          'When you turn on Study Reminders, the browser may ask for permission.',
          'You must click Allow for notifications to appear.',
          'If you clicked Block before, you need to change it in your browser site settings.',
          'These alerts are different from emails. Emails require a backend function.',
        ],
      },
      {
        heading: 'Useful controls',
        items: [
          'Study Reminders toggle: enables or disables browser alerts.',
          'Browser lock icon near the URL: lets you check if notifications are allowed.',
          'Refresh page: sometimes needed after changing browser permission.',
        ],
      },
    ],
  },

  {
    icon: Search,
    title: 'Search, Filters and Empty States',
    intro:
      'Some pages include search bars, filters or empty states. These small details help you find things and understand what to do next.',
    sections: [
      {
        heading: 'Search and filters',
        items: [
          'Search fields help you find books, notes, materials or tasks.',
          'Status filters show only certain items, such as Reading, Read or Want to Read.',
          'Tabs divide content into sections.',
          'If a page looks empty, it usually means you have not created anything there yet.',
        ],
      },
      {
        heading: 'Empty state buttons',
        items: [
          'Create your first goal: appears when you have no goals yet.',
          'Add your first book: appears when your library is empty.',
          'New note: appears when your notebook has no entries.',
          'These buttons are invitations to begin, not errors.',
        ],
      },
    ],
  },

  {
    icon: Save,
    title: 'Saving, Deleting and Going Back',
    intro:
      'These simple buttons appear across the whole app. They behave almost the same everywhere.',
    sections: [
      {
        heading: 'Common buttons',
        items: [
          'Save: stores changes in your account.',
          'Cancel: closes a form without saving.',
          'Back arrow: returns to the previous page or list.',
          'Edit / pencil: lets you change an existing item.',
          'Delete / trash: permanently removes an item.',
          'Upload: adds a file from your computer.',
          'Refresh: reloads or regenerates a piece of content.',
        ],
      },
      {
        heading: 'Important warning',
        items: [
          'Delete buttons are usually permanent.',
          'If something does not update immediately, go back and reopen the page or refresh.',
          'If a button does nothing, check the browser console for errors.',
        ],
      },
    ],
  },

  {
    icon: PlayCircle,
    title: 'A Simple Way to Begin',
    intro:
      'If you are not sure where to start, follow this simple path. You do not need to use every feature on the first day.',
    sections: [
      {
        heading: 'First-day path',
        items: [
          'Create one goal.',
          'Add three small tasks for that goal.',
          'Add one book or study material.',
          'Start one focus session.',
          'Write one short notebook reflection after studying.',
        ],
      },
      {
        heading: 'Best habit',
        items: [
          'Use the Dashboard first whenever you open the app.',
          'Let Tasks guide your day.',
          'Let Goals guide your month.',
          'Let the Notebook preserve what you learned.',
        ],
      },
    ],
  },

  {
    icon: Sparkles,
    title: 'The Doors Are Open',
    intro:
      'You now know the main rooms of the site and the small buttons that keep them working. Begin gently: one task, one page, one focused hour.',
    sections: [
      {
        heading: 'Remember',
        items: [
          'You can replay this guide anytime from the sidebar.',
          'You do not have to use every feature at once.',
          'The app is here to make studying calmer, clearer and more beautiful.',
        ],
      },
    ],
  },
];

export default function OnboardingTour({ onClose }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const chapter = CHAPTERS[step];
  const Icon = chapter.icon;
  const isLast = step === CHAPTERS.length - 1;

  const finish = async () => {
    setSaving(true);

    try {
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', user.id);
      }
    } catch (err) {
      console.error('Could not save onboarding status:', err);
    }

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-library-ink/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative max-w-3xl w-full max-h-[90vh] overflow-y-auto bg-page-cream border border-coffee-cream/30 rounded-sm shadow-cozy p-6 md:p-8 animate-fade-in-up">
        {/* Close */}
        <button
          onClick={finish}
          disabled={saving}
          className="absolute top-4 right-4 p-1.5 text-coffee-cream hover:text-maple-rust transition-colors disabled:opacity-50"
          title="Skip the guide"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <p className="font-ui text-xs uppercase tracking-widest text-gilmore-gold mb-4">
            Guided Tour · Chapter {step + 1} of {CHAPTERS.length}
          </p>

          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-maple-rust/30 bg-maple-rust/10 text-maple-rust">
            <Icon size={30} strokeWidth={1.5} />
          </div>

          <h2 className="font-display text-2xl md:text-3xl text-maple-rust mb-3">
            {chapter.title}
          </h2>

          <p className="font-body text-library-ink leading-relaxed max-w-2xl mx-auto">
            {chapter.intro}
          </p>
        </div>

        {/* Details */}
        <div key={step} className="space-y-5 animate-fade-in-up">
          {chapter.sections.map((section, index) => (
            <div
              key={index}
              className="border border-coffee-cream/20 bg-parchment/40 rounded-sm p-4"
            >
              <h3 className="font-ui text-xs uppercase tracking-widest text-yale-blue mb-3">
                {section.heading}
              </h3>

              <ul className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="flex gap-2 font-body text-sm md:text-base text-library-ink leading-relaxed"
                  >
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-maple-rust" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 my-7 flex-wrap">
          {CHAPTERS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-8 bg-maple-rust'
                  : i < step
                  ? 'w-3 bg-maple-rust/60'
                  : 'w-3 bg-coffee-cream/30'
              }`}
              title={`Go to chapter ${i + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={finish}
            disabled={saving}
            className="font-ui text-xs uppercase tracking-widest text-coffee-cream hover:text-maple-rust transition-colors underline underline-offset-4 disabled:opacity-50"
          >
            Skip guide
          </button>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2 border border-coffee-cream/40 rounded-sm font-ui text-xs uppercase tracking-widest text-library-ink hover:border-maple-rust hover:text-maple-rust transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}

            <button
              onClick={() => (isLast ? finish() : setStep(step + 1))}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-yale-blue text-page-cream rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-maple-rust transition-colors disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : isLast
                ? 'Begin My Journey'
                : 'Next Chapter'}

              {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}