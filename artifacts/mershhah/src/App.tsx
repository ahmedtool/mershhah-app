import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { LanguageProvider } from "@/components/shared/LanguageContext";
import { HydrationGate } from "@/components/shared/HydrationGate";

import HomePage from "@/app/page";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import RegisterAffiliatePage from "@/app/register-affiliate/page";
import ForgotPasswordPage from "@/app/forgot-password/page";
import PricingPage from "@/app/pricing/page";
import NotFoundPage from "@/app/not-found";

import OwnerLayout from "@/app/owner/layout";
import OwnerDashboardPage from "@/app/owner/dashboard/page";
import OwnerMenuPage from "@/app/owner/menu/page";
import OwnerOffersPage from "@/app/owner/offers/page";
import OwnerCustomizePage from "@/app/owner/customize/page";
import OwnerBranchesPage from "@/app/owner/branches/page";
import OwnerReviewsPage from "@/app/owner/reviews/page";
import OwnerSettingsPage from "@/app/owner/settings/page";
import OwnerStorePage from "@/app/owner/store/page";
import OwnerPricingPage from "@/app/owner/pricing/page";
import OwnerTicketsPage from "@/app/owner/tickets/page";
import OwnerTicketDetailPage from "@/app/owner/tickets/[ticketId]/page";
import OwnerToolsPage from "@/app/owner/tools/page";
import OwnerToolDetailPage from "@/app/owner/tools/[toolId]/page";
import DailyPulsePage from "@/app/owner/tools/daily-pulse-dashboard/page";
import MarketingCalendarPage from "@/app/owner/tools/marketing-calendar/page";
import ReplyTemplatesPage from "@/app/owner/tools/reply-templates/page";
import SummarizeFeedbackPage from "@/app/owner/tools/summarize-feedback/page";
import WeeklyContentWriterPage from "@/app/owner/tools/weekly-content-writer/page";
import OwnerSupportPage from "@/app/owner/support/page";


import AdminLayout from "@/app/admin/layout";
import AdminDashboardPage from "@/app/admin/dashboard/page";
import AdminManagementPage from "@/app/admin/management/page";
import AdminPlansPage from "@/app/admin/plans/page";
import AdminStorePage from "@/app/admin/store/page";
import AdminStoreManagementPage from "@/app/admin/store-management/page";
import AdminSupportPage from "@/app/admin/support/page";
import AdminSupportChatPage from "@/app/admin/support/[chatId]/page";
import AdminSettingsPage from "@/app/admin/settings/page";
import AdminTeamPage from "@/app/admin/team/page";
import AdminSalesPage from "@/app/admin/sales/page";
import AdminApplicationsPage from "@/app/admin/applications/page";
import AdminAnnouncementsPage from "@/app/admin/announcements/page";
import AdminWorkflowPage from "@/app/admin/workflow/page";
import AdminFinancialsPage from "@/app/admin/financials/page";
import AdminFinancialsPlansPage from "@/app/admin/financials/plans/page";
import AdminFinancialsOrdersPage from "@/app/admin/financials/orders/page";
import AdminFinancialsDiscountsPage from "@/app/admin/financials/discounts/page";

import MenuPage from "@/app/menu/[username]/page";
import HubPage from "@/app/hub/[username]/page";
import AiPage from "@/app/ai/[username]/page";
import BranchesPublicPage from "@/app/branches/[username]/page";
import ChatPage from "@/app/chat/[username]/page";
import ReviewsPublicPage from "@/app/reviews/[username]/page";
import BlogListPage from "@/app/blog/page";
import BlogPostPage from "@/app/blog/[slug]/page";
import AboutPage from "@/app/about/page";
import ContactPage from "@/app/contact/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import BioPage from "@/app/bio/page";
import SuccessPage from "@/app/success/page";
import FailurePage from "@/app/failure/page";
import ReferPage from "@/app/refer/page";
import StatusPage from "@/app/status/page";
import TicketPage from "@/app/ticket/page";
import SupportPublicPage from "@/app/support/[username]/page";
import OAuthConsentPage from "@/app/oauth/consent/page";

const queryClient = new QueryClient();

function withOwnerLayout<P extends object>(Page: React.ComponentType<P>) {
  return function WrappedOwnerPage(props: P) {
    return <OwnerLayout><Page {...props} /></OwnerLayout>;
  };
}

function withAdminLayout<P extends object>(Page: React.ComponentType<P>) {
  return function WrappedAdminPage(props: P) {
    return <AdminLayout><Page {...props} /></AdminLayout>;
  };
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/register-affiliate" component={RegisterAffiliatePage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/bio" component={BioPage} />
      <Route path="/success" component={SuccessPage} />
      <Route path="/failure" component={FailurePage} />
      <Route path="/refer" component={ReferPage} />
      <Route path="/status" component={StatusPage} />
      <Route path="/ticket" component={TicketPage} />
      <Route path="/support/:username" component={SupportPublicPage} />
      <Route path="/oauth/consent" component={OAuthConsentPage} />
      <Route path="/blog" component={BlogListPage} />
      <Route path="/blog/:slug" component={BlogPostPage} />
      <Route path="/menu/:username" component={MenuPage} />
      <Route path="/hub/:username" component={HubPage} />
      <Route path="/ai/:username" component={AiPage} />
      <Route path="/branches/:username" component={BranchesPublicPage} />
      <Route path="/chat/:username" component={ChatPage} />
      <Route path="/reviews/:username" component={ReviewsPublicPage} />

      <Route path="/owner/dashboard" component={withOwnerLayout(OwnerDashboardPage)} />
      <Route path="/owner/menu" component={withOwnerLayout(OwnerMenuPage)} />
      <Route path="/owner/offers" component={withOwnerLayout(OwnerOffersPage)} />
      <Route path="/owner/customize" component={withOwnerLayout(OwnerCustomizePage)} />
      <Route path="/owner/branches" component={withOwnerLayout(OwnerBranchesPage)} />
      <Route path="/owner/reviews" component={withOwnerLayout(OwnerReviewsPage)} />
      <Route path="/owner/settings" component={withOwnerLayout(OwnerSettingsPage)} />
      <Route path="/owner/store" component={withOwnerLayout(OwnerStorePage)} />
      <Route path="/owner/pricing" component={withOwnerLayout(OwnerPricingPage)} />
      <Route path="/owner/tickets/:ticketId" component={withOwnerLayout(OwnerTicketDetailPage)} />
      <Route path="/owner/tickets" component={withOwnerLayout(OwnerTicketsPage)} />
      <Route path="/owner/tools/daily-pulse-dashboard" component={withOwnerLayout(DailyPulsePage)} />
      <Route path="/owner/tools/marketing-calendar" component={withOwnerLayout(MarketingCalendarPage)} />
      <Route path="/owner/tools/reply-templates" component={withOwnerLayout(ReplyTemplatesPage)} />
      <Route path="/owner/tools/summarize-feedback" component={withOwnerLayout(SummarizeFeedbackPage)} />
      <Route path="/owner/tools/weekly-content-writer" component={withOwnerLayout(WeeklyContentWriterPage)} />
      <Route path="/owner/tools/:toolId" component={withOwnerLayout(OwnerToolDetailPage)} />
      <Route path="/owner/tools" component={withOwnerLayout(OwnerToolsPage)} />
      <Route path="/owner/support" component={withOwnerLayout(OwnerSupportPage)} />
      <Route path="/owner" component={withOwnerLayout(OwnerDashboardPage)} />

      <Route path="/admin/dashboard" component={withAdminLayout(AdminDashboardPage)} />
      <Route path="/admin/management" component={withAdminLayout(AdminManagementPage)} />
      <Route path="/admin/plans" component={withAdminLayout(AdminPlansPage)} />
      <Route path="/admin/store" component={withAdminLayout(AdminStorePage)} />
      <Route path="/admin/store-management" component={withAdminLayout(AdminStoreManagementPage)} />
      <Route path="/admin/support/:chatId" component={withAdminLayout(AdminSupportChatPage)} />
      <Route path="/admin/support" component={withAdminLayout(AdminSupportPage)} />
      <Route path="/admin/settings" component={withAdminLayout(AdminSettingsPage)} />
      <Route path="/admin/team" component={withAdminLayout(AdminTeamPage)} />
      <Route path="/admin/sales" component={withAdminLayout(AdminSalesPage)} />
      <Route path="/admin/applications" component={withAdminLayout(AdminApplicationsPage)} />
      <Route path="/admin/announcements" component={withAdminLayout(AdminAnnouncementsPage)} />
      <Route path="/admin/workflow" component={withAdminLayout(AdminWorkflowPage)} />
      <Route path="/admin/financials/plans" component={withAdminLayout(AdminFinancialsPlansPage)} />
      <Route path="/admin/financials/orders" component={withAdminLayout(AdminFinancialsOrdersPage)} />
      <Route path="/admin/financials/discounts" component={withAdminLayout(AdminFinancialsDiscountsPage)} />
      <Route path="/admin/financials" component={withAdminLayout(AdminFinancialsPage)} />
      <Route path="/admin" component={withAdminLayout(AdminDashboardPage)} />

      <Route component={NotFoundPage} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <LanguageProvider>
            <HydrationGate>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </HydrationGate>
          </LanguageProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
