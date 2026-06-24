import { useEffect, useRef } from "react";

export default function PublicCateringForm() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Avoid duplicate scripts on re-render
    const existingScript = containerRef.current.querySelector('script');
    if (existingScript) return;

    // Create and append the script element
    const script = document.createElement('script');
    script.id = '__custom_form_widget';
    script.async = true;
    script.src = 'https://www.cdnstyles.com/static/custom_form_widget/v1/custom_form.widget.js';
    script.setAttribute('data', 'eyJiYWNrZ3JvdW5kQ29sb3IiOiIjRkZGRkZGIiwiYmFzZVVSTCI6Imh0dHBzOi8vZm9ybXMtcHJvZC5hcGlnYXRld2F5LmNvIiwiYm9yZGVyQ29sb3IiOiIjRTJFOEYwIiwiYm9yZGVyUmFkaXVzIjoiMTJweCIsImJvcmRlclN0eWxlIjoic29saWQiLCJib3JkZXJXaWR0aCI6IjFweCIsImZvcm1JZCI6IkZvcm1Db25maWdJRC1mZTMyNDk3ZS1iN2Y2LTQyYjktYjc0ZS1iNjY4N2E0NjA0NTYiLCJwYWRkaW5nIjoiMzJweCIsInByaW1hcnlDb2xvciI6IiMwRjE3MkEiLCJwcmltYXJ5Rm9udENvbG9yIjoiIzAyMDgxNyIsIndpZHRoIjoiMTAwJSJ9');
    script.setAttribute('data-crm-form-widget', '');

    containerRef.current.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary font-serif italic mb-2">
          Square Peg
        </h1>
        <p className="text-muted-foreground tracking-widest uppercase text-sm font-semibold">Catering Request</p>
      </div>

      {/* Form Card */}
      <div className="max-w-2xl w-full">
        <p className="text-muted-foreground mb-8 text-center">
          Fill out the form below with your event details, and our team will get back to you with a quote.
        </p>
        
        {/* Hosted Form Embed */}
        <div ref={containerRef} className="w-full min-h-[500px]" />
      </div>
    </div>
  );
}
