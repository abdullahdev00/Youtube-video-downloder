import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, Download, Shield, Zap, Globe, Settings } from "lucide-react";

const faqData = [
  {
    category: "General",
    icon: HelpCircle,
    questions: [
      {
        question: "What is YTDownloader Pro?",
        answer: "YTDownloader Pro is a fast, secure, and reliable YouTube video downloader that allows you to download videos in various formats and qualities. It supports HD downloads, multiple formats, and provides an ad-free experience for premium users."
      },
      {
        question: "Is it free to use?",
        answer: "Yes! We offer a free plan that allows you to download up to 5 videos per day in standard quality. For unlimited downloads and premium features, you can upgrade to our Premium or Pro plans."
      },
      {
        question: "Do I need to register to download videos?",
        answer: "No registration is required for our free plan. Simply paste a YouTube URL and start downloading immediately. However, creating an account unlocks additional features like download history and favorites."
      },
      {
        question: "Is YTDownloader Pro safe to use?",
        answer: "Absolutely! We use SSL encryption for all data transfers, don't store your personal information unnecessarily, and our service is regularly scanned for security vulnerabilities. We also don't require any software downloads - everything works directly in your browser."
      }
    ]
  },
  {
    category: "Downloads",
    icon: Download,
    questions: [
      {
        question: "What video qualities are supported?",
        answer: "We support multiple quality options: 360p, 480p, 720p HD, 1080p Full HD, and up to 4K (2160p) for Premium users. The available qualities depend on the source video's original resolution."
      },
      {
        question: "What formats can I download?",
        answer: "We support various formats including MP4 (video), MP3 (audio), WebM, and more. Premium users get access to all formats, while free users can download MP4 and MP3 formats."
      },
      {
        question: "How fast are the downloads?",
        answer: "Download speeds depend on your internet connection and the video size. Premium users get priority processing, which means faster conversion and download speeds, especially during peak hours."
      },
      {
        question: "Can I download multiple videos at once?",
        answer: "Yes! Premium users can download up to 50 videos in batch, while Pro users have unlimited batch downloads. Free users need to download videos one at a time."
      },
      {
        question: "Can I download video subtitles?",
        answer: "Yes, Premium and Pro users can download subtitles along with videos. We support multiple subtitle formats and languages available on the original video."
      }
    ]
  },
  {
    category: "Technical",
    icon: Settings,
    questions: [
      {
        question: "Why isn't my video downloading?",
        answer: "This could be due to several reasons: the video might be private, age-restricted, or have download restrictions. YouTube also has bot detection that sometimes blocks downloads. Try again later or contact support if the issue persists."
      },
      {
        question: "What browsers are supported?",
        answer: "YTDownloader Pro works on all modern browsers including Chrome, Firefox, Safari, and Edge. We recommend using the latest version of your browser for the best experience."
      },
      {
        question: "Do you have an API?",
        answer: "Yes! Pro plan users get access to our API with 1000 calls per day. This allows you to integrate video downloading functionality into your own applications. Contact our sales team for higher API limits."
      },
      {
        question: "Can I use this on mobile devices?",
        answer: "Absolutely! Our service is fully responsive and works perfectly on smartphones and tablets. The interface adapts to your screen size for optimal usability."
      }
    ]
  },
  {
    category: "Legal & Privacy",
    icon: Shield,
    questions: [
      {
        question: "Is downloading YouTube videos legal?",
        answer: "Downloading videos for personal, non-commercial use is generally acceptable, but you should respect copyright laws and YouTube's terms of service. Always ensure you have permission to download copyrighted content."
      },
      {
        question: "Do you store my downloaded videos?",
        answer: "No, we don't store your videos on our servers. Downloads are processed in real-time and delivered directly to your device. We respect your privacy and don't keep copies of your content."
      },
      {
        question: "What data do you collect?",
        answer: "We only collect minimal data necessary for service operation: basic usage statistics and error logs for improvement. Premium users' download history is stored securely and can be deleted anytime. We never sell your data to third parties."
      },
      {
        question: "How do you handle copyright concerns?",
        answer: "We take copyright seriously and comply with DMCA requests. Our service is designed for personal use, and we encourage users to respect content creators' rights and YouTube's terms of service."
      }
    ]
  },
  {
    category: "Account & Billing",
    icon: Globe,
    questions: [
      {
        question: "How do I upgrade to Premium?",
        answer: "Click on any 'Start Premium Trial' button to begin your upgrade. We offer a 7-day free trial for new users, and you can cancel anytime before the trial ends without being charged."
      },
      {
        question: "Can I cancel my subscription anytime?",
        answer: "Yes, you can cancel your subscription at any time from your account settings. You'll continue to have access to premium features until the end of your current billing period."
      },
      {
        question: "Do you offer refunds?",
        answer: "We offer a 30-day money-back guarantee for all paid plans. If you're not satisfied, contact our support team within 30 days of your purchase for a full refund."
      },
      {
        question: "What payment methods do you accept?",
        answer: "We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and various local payment methods depending on your region. All payments are processed securely through Stripe."
      }
    ]
  },
  {
    category: "Support",
    icon: Zap,
    questions: [
      {
        question: "How can I contact support?",
        answer: "Free users can contact us through our help center and community forums. Premium users get email support with 24-hour response time, while Pro users receive priority support with 1-hour response guarantee."
      },
      {
        question: "Do you have a mobile app?",
        answer: "Currently, we're a web-based service that works perfectly on mobile browsers. We're developing native mobile apps for iOS and Android - stay tuned for updates!"
      },
      {
        question: "Can I suggest new features?",
        answer: "Absolutely! We love hearing from our users. Submit feature requests through our feedback form or community forum. Premium and Pro users' suggestions get priority consideration in our development roadmap."
      },
      {
        question: "How often do you update the service?",
        answer: "We continuously update our service to stay compatible with YouTube changes and add new features. Major updates are released monthly, while security and compatibility updates happen as needed."
      }
    ]
  }
];

export function FAQSection() {
  return (
    <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about YTDownloader Pro
          </p>
        </div>

        {/* FAQ Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {faqData.map((category, categoryIndex) => {
            const IconComponent = category.icon;
            return (
              <div key={categoryIndex} className="space-y-6">
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {category.category}
                  </h3>
                </div>

                {/* Questions */}
                <Accordion type="single" collapsible className="space-y-2">
                  {category.questions.map((faq, questionIndex) => (
                    <AccordionItem 
                      key={questionIndex} 
                      value={`${categoryIndex}-${questionIndex}`}
                      className="border border/50 rounded-lg px-4 hover-elevate transition-all duration-200"
                    >
                      <AccordionTrigger className="text-left hover:no-underline py-4">
                        <span className="text-sm font-medium text-foreground">
                          {faq.question}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {faq.answer}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            );
          })}
        </div>

        {/* Support Contact */}
        <div className="mt-16 text-center">
          <div className="bg-muted/30 rounded-lg p-8 border border/50">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              Still have questions?
            </h3>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Can't find the answer you're looking for? Our support team is here to help you get the most out of YTDownloader Pro.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-8 w-8 bg-chart-2/20 rounded-full flex items-center justify-center">
                  <Zap className="h-4 w-4 text-chart-2" />
                </div>
                <span>24/7 Community Support</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-8 w-8 bg-chart-2/20 rounded-full flex items-center justify-center">
                  <Shield className="h-4 w-4 text-chart-2" />
                </div>
                <span>Premium Email Support</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-8 w-8 bg-chart-2/20 rounded-full flex items-center justify-center">
                  <HelpCircle className="h-4 w-4 text-chart-2" />
                </div>
                <span>Comprehensive Help Center</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}