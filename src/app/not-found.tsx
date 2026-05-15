import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 bg-background">
      <div className="max-w-md text-center space-y-4">
        <img src="/Light.png" alt="Orcazo" className="h-10 mx-auto dark:hidden" />
        <img src="/Dark.png" alt="Orcazo" className="h-10 mx-auto hidden dark:block" />
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
