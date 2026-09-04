import { Switch, Route, Router as WouterRouter } from "wouter";
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { LanguageProvider } from "@/components/shared/LanguageContext";
import { HydrationGate } from "@/components/shared/HydrationGate";
import { UserProvider } from "@/hooks/useUser";
import { Loader2 } from "lucide-react";

const HomePage = lazy(() => import("@/app/page"));
const LoginPage = lazy(() => import("@/app/login/page"));
const RegisterPage = lazy(() => import("@/app/register/page"));
const RegisterAffiliatePage = lazy(() => import("@/app/register-affiliate/page"));
const ForgotPasswordPage = lazy(() => import("@/app/forgot-password/page"));
const ResetPasswordPage = lazy(() => import("@/app/reset-password/page"));
const PricingPage = lazy(() => import("@/app/pricing/page"));
const NotFoundPage = lazy(() => import("@/app/not-found"));

const OwnerLayout = lazy(() => import("@/app/owner/layout"));
const OwnerDashboardPage = lazy(() => import("@/app/owner/dashboard/page"));
const OwnerMenuPage = lazy(() => import("@/app/owner/menu/page"));
const OwnerOffersPage = lazy(() => import("@/app/owner/offers/page"));
const OwnerCustomizePage = lazy(() => import("@/app/owner/customize/page"));
const OwnerBranchesPage = lazy(() => import("@/app/owner/branches/page"));
const OwnerReviewsPage = lazy(() => import("@/app/owner/reviews/page"));
const OwnerSettingsPage = lazy(() => import("@/app/owner/settings/page"));
const OwnerStorePage = lazy(() => import("@/app/owner/store/page"));
const OwnerReportsPage = lazy(() => import("@/app/owner/reports/page"));
const OwnerTicketsPage = lazy(() => import("@/app/owner/tickets/page"));
const OwnerTicketDetailPage = lazy(() => import("@/app/owner/tickets/[ticketId]/page"));
const OwnerToolsPage = lazy(() => import("@/app/owner/tools/page"));
const OwnerToolDetailPage = lazy(() => import("@/app/owner/tools/[toolId]/page"));
const DailyPulsePage = lazy(() => import("@/app/owner/tools/daily-pulse-dashboard/page"));
const MarketingCalendarPage = lazy(() => import("@/app/owner/tools/marketing-calendar/page"));
const ReplyTemplatesPage = lazy(() => import("@/app/owner/tools/reply-templates/page"));
const SummarizeFeedbackPage = lazy(() => import("@/app/owner/tools/summarize-feedback/page"));
const WeeklyContentWriterPage = lazy(() => import("@/app/owner/tools/weekly-content-writer/page"));
const SalaryCalculatorPage = lazy(() => import("@/app/owner/tools/salary-calculator/page"));
const CostCalculatorPage = lazy(() => import("@/app/owner/tools/cost-calculator/page"));
const ImageEnhancerPage = lazy(() => import("@/app/owner/tools/image-enhancer/page"));
const KeetaReportsReaderPage = lazy(() => import("@/app/owner/tools/keeta-reports-reader/page"));
const HungerStationReportsReaderPage = lazy(() => import("@/app/owner/tools/hungerstation-reports-reader/page"));
const OwnerSupportPage = lazy(() => import("@/app/owner/support/page"));
const OwnerBillingPage = lazy(() => import("@/app/owner/billing/page"));

const AdminLayout = lazy(() => import("@/app/admin/layout"));
const AdminDashboardPage = lazy(() => import("@/app/admin/dashboard/page"));
const AdminManagementPage = lazy(() => import("@/app/admin/management/page"));
const AdminPlansPage = lazy(() => import("@/app/admin/plans/page"));
const AdminStorePage = lazy(() => import("@/app/admin/store/page"));
const AdminStoreDevelopersPage = lazy(() => import("@/app/admin/store/developers/page"));
const AdminStoreManagementPage = lazy(() => import("@/app/admin/store-management/page"));
const AdminSharedProductsPage = lazy(() => import("@/app/admin/shared-products/page"));
const AdminSupportPage = lazy(() => import("@/app/admin/support/page"));
const AdminSupportChatPage = lazy(() => import("@/app/admin/support/[chatId]/page"));
const AdminSettingsPage = lazy(() => import("@/app/admin/settings/page"));
const AdminTeamPage = lazy(() => import("@/app/admin/team/page"));
const AdminSalesPage = lazy(() => import("@/app/admin/sales/page"));
const AdminApplicationsPage = lazy(() => import("@/app/admin/applications/page"));
const AdminAnnouncementsPage = lazy(() => import("@/app/admin/announcements/page"));
const AdminBlogPage = lazy(() => import("@/app/admin/blog/page"));
const AdminWorkflowPage = lazy(() => import("@/app/admin/workflow/page"));
const AdminDiscountsPage = lazy(() => import("@/app/admin/discounts/page"));
const AdminFinancialsPage = lazy(() => import("@/app/admin/financials/page"));
const AdminFinancialsOrdersPage = lazy(() => import("@/app/admin/financials/orders/page"));
const AdminFinancialsDiscountsPage = lazy(() => import("@/app/admin/financials/discounts/page"));

const MenuPage = lazy(() => import("@/app/menu/[username]/page"));
const HubPage = lazy(() => import("@/app/hub/[username]/page"));
const AiPage = lazy(() => import("@/app/ai/[username]/page"));
const BranchesPublicPage = lazy(() => import("@/app/branches/[username]/page"));
const ChatPage = lazy(() => import("@/app/chat/[username]/page"));
const ReviewsPublicPage = lazy(() => import("@/app/reviews/[username]/page"));
const BlogListPage = lazy(() => import("@/app/blog/page"));
const BlogPostPage = lazy(() => import("@/app/blog/[slug]/page"));
const AboutPage = lazy(() => import("@/app/about/page"));
const ContactPage = lazy(() => import("@/app/contact/page"));
const PrivacyPage = lazy(() => import("@/app/privacy/page"));
const TermsPage = lazy(() => import("@/app/terms/page"));
const BioPage = lazy(() => import("@/app/bio/page"));
const SuccessPage = lazy(() => import("@/app/success/page"));
const FailurePage = lazy(() => import("@/app/failure/page"));
const BillingSuccessPage = lazy(() => import("@/app/billing/success/page"));
const BillingFailedPage = lazy(() => import("@/app/billing/failed/page"));
const ReferPage = lazy(() => import("@/app/refer/page"));
const StatusPage = lazy(() => import("@/app/status/page"));
const TicketPage = lazy(() => import("@/app/ticket/page"));
const SupportPublicPage = lazy(() => import("@/app/support/[username]/page"));
const OAuthConsentPage = lazy(() => import("@/app/oauth/consent/page"));

const queryClient = new QueryClient();

const OW = ({ children }: { children: React.ReactNode }) => <OwnerLayout>{children}</OwnerLayout>;

// Shown while a route's own JS chunk is still downloading (only happens the
// first time a given route is visited in a session - cached afterward).
function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <Loader2 className="animate-spin h-6 w-6 text-gray-300" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/register-affiliate" component={RegisterAffiliatePage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/bio" component={BioPage} />
        <Route path="/success" component={SuccessPage} />
        <Route path="/failure" component={FailurePage} />
        <Route path="/billing/success" component={BillingSuccessPage} />
        <Route path="/billing/failed" component={BillingFailedPage} />
        <Route path="/refer" component={ReferPage} />
        <Route path="/status" component={StatusPage} />
        <Route path="/ticket" component={TicketPage} />
        <Route path="/support/:username" component={SupportPublicPage} />
        <Route path="/oauth/consent" component={OAuthConsentPage} />
        <Route path="/blog" component={BlogListPage} />
        <Route path="/blog/:slug" component={BlogPostPage} />
        <Route path="/menu/:username" component={MenuPage} />
        <Route path="/ai/:username" component={AiPage} />
        <Route path="/branches/:username" component={BranchesPublicPage} />
        <Route path="/chat/:username" component={ChatPage} />
        <Route path="/reviews/:username" component={ReviewsPublicPage} />
        <Route path="/owner/dashboard" component={() => <OW><OwnerDashboardPage /></OW>} />
        <Route path="/owner/menu" component={() => <OW><OwnerMenuPage /></OW>} />
        <Route path="/owner/offers" component={() => <OW><OwnerOffersPage /></OW>} />
        <Route path="/owner/customize" component={() => <OW><OwnerCustomizePage /></OW>} />
        <Route path="/owner/branches" component={() => <OW><OwnerBranchesPage /></OW>} />
        <Route path="/owner/reviews" component={() => <OW><OwnerReviewsPage /></OW>} />
        <Route path="/owner/settings" component={() => <OW><OwnerSettingsPage /></OW>} />
        <Route path="/owner/store" component={() => <OW><OwnerStorePage /></OW>} />
        <Route path="/owner/reports" component={() => <OW><OwnerReportsPage /></OW>} />
        <Route path="/owner/tickets/:ticketId" component={() => <OW><OwnerTicketDetailPage /></OW>} />
        <Route path="/owner/tickets" component={() => <OW><OwnerTicketsPage /></OW>} />
        <Route path="/owner/tools/daily-pulse-dashboard" component={() => <OW><DailyPulsePage /></OW>} />
        <Route path="/owner/tools/marketing-calendar" component={() => <OW><MarketingCalendarPage /></OW>} />
        <Route path="/owner/tools/reply-templates" component={() => <OW><ReplyTemplatesPage /></OW>} />
        <Route path="/owner/tools/summarize-feedback" component={() => <OW><SummarizeFeedbackPage /></OW>} />
        <Route path="/owner/tools/weekly-content-writer" component={() => <OW><WeeklyContentWriterPage /></OW>} />
        <Route path="/owner/tools/salary-calculator" component={() => <OW><SalaryCalculatorPage /></OW>} />
        <Route path="/owner/tools/cost-calculator" component={() => <OW><CostCalculatorPage /></OW>} />
        <Route path="/owner/tools/image-enhancer" component={() => <OW><ImageEnhancerPage /></OW>} />
        <Route path="/owner/tools/keeta-reports-reader" component={() => <OW><KeetaReportsReaderPage /></OW>} />
        <Route path="/owner/tools/hungerstation-reports-reader" component={() => <OW><HungerStationReportsReaderPage /></OW>} />
        <Route path="/owner/tools/:toolId" component={() => <OW><OwnerToolDetailPage /></OW>} />
        <Route path="/owner/tools" component={() => <OW><OwnerToolsPage /></OW>} />
        <Route path="/owner/support" component={() => <OW><OwnerSupportPage /></OW>} />
        <Route path="/owner/billing" component={() => <OW><OwnerBillingPage /></OW>} />
        <Route path="/admin/dashboard" component={() => <AdminLayout><AdminDashboardPage /></AdminLayout>} />
        <Route path="/admin/management" component={() => <AdminLayout><AdminManagementPage /></AdminLayout>} />
        <Route path="/admin/plans" component={() => <AdminLayout><AdminPlansPage /></AdminLayout>} />
        <Route path="/admin/store" component={() => <AdminLayout><AdminStorePage /></AdminLayout>} />
        <Route path="/admin/store/developers" component={() => <AdminLayout><AdminStoreDevelopersPage /></AdminLayout>} />
        <Route path="/admin/store-management" component={() => <AdminLayout><AdminStoreManagementPage /></AdminLayout>} />
        <Route path="/admin/shared-products" component={() => <AdminLayout><AdminSharedProductsPage /></AdminLayout>} />
        <Route path="/admin/support/:chatId" component={() => <AdminLayout><AdminSupportChatPage /></AdminLayout>} />
        <Route path="/admin/support" component={() => <AdminLayout><AdminSupportPage /></AdminLayout>} />
        <Route path="/admin/settings" component={() => <AdminLayout><AdminSettingsPage /></AdminLayout>} />
        <Route path="/admin/team" component={() => <AdminLayout><AdminTeamPage /></AdminLayout>} />
        <Route path="/admin/sales" component={() => <AdminLayout><AdminSalesPage /></AdminLayout>} />
        <Route path="/admin/applications" component={() => <AdminLayout><AdminApplicationsPage /></AdminLayout>} />
        <Route path="/admin/announcements" component={() => <AdminLayout><AdminAnnouncementsPage /></AdminLayout>} />
        <Route path="/admin/blog" component={() => <AdminLayout><AdminBlogPage /></AdminLayout>} />
        <Route path="/admin/workflow" component={() => <AdminLayout><AdminWorkflowPage /></AdminLayout>} />
        <Route path="/admin/financials" component={() => <AdminLayout><AdminFinancialsPage /></AdminLayout>} />
        <Route path="/admin/financials/orders" component={() => <AdminLayout><AdminFinancialsOrdersPage /></AdminLayout>} />
        <Route path="/admin/financials/discounts" component={() => <AdminLayout><AdminFinancialsDiscountsPage /></AdminLayout>} />
        <Route path="/admin/discounts" component={() => <AdminLayout><AdminDiscountsPage /></AdminLayout>} />
        <Route path="/:username" component={HubPage} />
        <Route component={NotFoundPage} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <LanguageProvider>
            <HydrationGate>
              <UserProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                  <Router />
                </WouterRouter>
              </UserProvider>
              <Toaster />
            </HydrationGate>
          </LanguageProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
