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

function OwnerRoutes({ params }: { params?: any }) {
  return (
    <OwnerLayout>
      <Switch>
        <Route path="/owner/dashboard" component={OwnerDashboardPage} />
        <Route path="/owner/menu" component={OwnerMenuPage} />
        <Route path="/owner/offers" component={OwnerOffersPage} />
        <Route path="/owner/customize" component={OwnerCustomizePage} />
        <Route path="/owner/branches" component={OwnerBranchesPage} />
        <Route path="/owner/reviews" component={OwnerReviewsPage} />
        <Route path="/owner/settings" component={OwnerSettingsPage} />
        <Route path="/owner/store" component={OwnerStorePage} />
        <Route path="/owner/pricing" component={OwnerPricingPage} />
        <Route path="/owner/tickets/:ticketId" component={OwnerTicketDetailPage} />
        <Route path="/owner/tickets" component={OwnerTicketsPage} />
        <Route path="/owner/tools/daily-pulse-dashboard" component={DailyPulsePage} />
        <Route path="/owner/tools/marketing-calendar" component={MarketingCalendarPage} />
        <Route path="/owner/tools/reply-templates" component={ReplyTemplatesPage} />
        <Route path="/owner/tools/summarize-feedback" component={SummarizeFeedbackPage} />
        <Route path="/owner/tools/weekly-content-writer" component={WeeklyContentWriterPage} />
        <Route path="/owner/tools/:toolId" component={OwnerToolDetailPage} />
        <Route path="/owner/tools" component={OwnerToolsPage} />
        <Route path="/owner/support" component={OwnerSupportPage} />

        <Route component={NotFoundPage} />
      </Switch>
    </OwnerLayout>
  );
}

function AdminRoutes({ params }: { params?: any }) {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin/dashboard" component={AdminDashboardPage} />
        <Route path="/admin/management" component={AdminManagementPage} />
        <Route path="/admin/plans" component={AdminPlansPage} />
        <Route path="/admin/store" component={AdminStorePage} />
        <Route path="/admin/store-management" component={AdminStoreManagementPage} />
        <Route path="/admin/support/:chatId" component={AdminSupportChatPage} />
        <Route path="/admin/support" component={AdminSupportPage} />
        <Route path="/admin/settings" component={AdminSettingsPage} />
        <Route path="/admin/team" component={AdminTeamPage} />
        <Route path="/admin/sales" component={AdminSalesPage} />
        <Route path="/admin/applications" component={AdminApplicationsPage} />
        <Route path="/admin/announcements" component={AdminAnnouncementsPage} />
        <Route path="/admin/workflow" component={AdminWorkflowPage} />
        <Route component={NotFoundPage} />
      </Switch>
    </AdminLayout>
  );
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
      <Route path="/owner/:rest*" component={OwnerRoutes} />
      <Route path="/admin/:rest*" component={AdminRoutes} />
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
