'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  DollarSign,
  CreditCard,
  Clock,
  Wallet,
  BarChart3,
  UserPlus,
  AlertTriangle,
  MessageCircle,
  HelpCircle,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FaqItem {
  question: string;
  answer: string;
  icon: React.ElementType;
}

const faqItems: FaqItem[] = [
  {
    question: 'How do I get paid?',
    answer:
      'Orcazo pays creators via direct bank transfer or PayPal. Once your balance reaches the minimum payout threshold, you can request a withdrawal from your Payouts page. Payments are processed on a rolling basis.',
    icon: DollarSign,
  },
  {
    question: 'What are the payment methods?',
    answer:
      'We currently support PayPal and direct bank transfers (ACH for US creators, wire transfer for international creators). You can configure your preferred payment method in your payout settings.',
    icon: CreditCard,
  },
  {
    question: 'How long does it take to get paid?',
    answer:
      'After you request a payout, it typically takes 5-7 business days for the funds to reach your account. PayPal transfers may arrive sooner (1-3 business days). Processing times can vary depending on your bank and region.',
    icon: Clock,
  },
  {
    question: 'What is the minimum payout?',
    answer:
      'The minimum payout threshold is $25. Once your earned balance reaches this amount, you can request a withdrawal. Balances below the minimum will carry over to the next payout period.',
    icon: Wallet,
  },
  {
    question: 'How do views get tracked?',
    answer:
      'Views are tracked through the unique campaign links assigned to your content. When a viewer clicks your link or watches your promoted content, the view is recorded and attributed to your account. View counts are updated throughout the day, though there may be a short delay of 15-20 seconds for processing.',
    icon: BarChart3,
  },
  {
    question: 'How do I add a social account?',
    answer:
      'Go to the Social Accounts page from the sidebar menu. Click "Add Account" and follow the prompts to connect your YouTube, TikTok, Instagram, or other supported platform. You will need to authorize Orcazo to verify your account ownership.',
    icon: UserPlus,
  },
  {
    question: 'What if my video gets removed?',
    answer:
      'If a video associated with a campaign is removed (either by you or the platform), earnings for that video may be adjusted. We recommend keeping campaign content live for the full duration specified in the campaign terms. If a video is removed due to a platform error, contact support and we will review your case.',
    icon: AlertTriangle,
  },
  {
    question: 'How do I contact support?',
    answer:
      'You can reach our support team directly through the live chat on the Support page. Navigate to Support in the sidebar and send us a message -- our team typically responds within a few hours during business days.',
    icon: MessageCircle,
  },
];

function AccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = item.icon;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <span className="flex-1 text-sm font-medium">{item.question}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <p className="px-4 pb-4 pl-15 text-sm leading-relaxed text-muted-foreground">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FaqPage() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  function handleToggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index));
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Support
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HelpCircle className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Frequently Asked Questions
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1 pl-[52px]">
          Find answers to common questions about payments, tracking, and your account.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {faqItems.map((item, index) => (
            <AccordionItem
              key={index}
              item={item}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </CardContent>
      </Card>

      <div className="mt-8 rounded-lg border bg-muted/30 p-6 text-center">
        <p className="text-sm font-medium mb-1">Still have questions?</p>
        <p className="text-xs text-muted-foreground mb-4">
          Our support team is here to help.
        </p>
        <Link
          href="/support"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <MessageCircle className="h-4 w-4" />
          Chat with Support
        </Link>
      </div>
    </div>
  );
}
