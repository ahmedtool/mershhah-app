import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { LanguageProvider } from "@/components/shared/LanguageContext";
import { HydrationGate } from "@/components/shared/HydrationGate";
import { UserProvider } from "@/hooks/useUser";

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

function withOwnerLayout(Page: React.ComponentType<any>) {
  const Wrapped = (props: any) => <OwnerLayout><Page {...props} /></OwnerLayout>;
  Wrapped.displayName = `WithOwnerLayout(${Page.displayName || Page.name || 'Page'})`;
  return Wrapped;
}

function withAdminLayout(Page: React.ComponentType<any>) {
  const Wrapped = (props: any) => <AdminLayout><Page {...props} /></AdminLayout>;
  Wrapped.displayName = `WithAdminLayout(${Page.displayName || Page.name || 'Page'})`;
  return Wrapped;
}

const OwnerDashboardLayout = withOwnerLayout(OwnerDashboardPage);
const OwnerMenuLayout = withOwnerLayout(OwnerMenuPage);
const OwnerOffersLayout = withOwnerLayout(OwnerOffersPage);
const OwnerCustomizeLayout = withOwnerLayout(OwnerCustomizePage);
const OwnerBranchesLayout = withOwnerLayout(OwnerBranchesPage);
const OwnerReviewsLayout = withOwnerLayout(OwnerReviewsPage);
const OwnerSettingsLayout = withOwnerLayout(OwnerSettingsPage);
const OwnerStoreLayout = withOwnerLayout(OwnerStorePage);
const OwnerPricingLayout = withOwnerLayout(OwnerPricingPage);
const OwnerTicketDetailLayout = withOwnerLayout(OwnerTicketDetailPage);
const OwnerTicketsLayout = withOwnerLayout(OwnerTicketsPage);
const DailyPulseLayout = withOwnerLayout(DailyPulsePage);
const MarketingCalendarLayout = withOwnerLayout(MarketingCalendarPage);
const ReplyTemplatesLayout = withOwnerLayout(ReplyTemplatesPage);
const SummarizeFeedbackLayout = withOwnerLayout(SummarizeFeedbackPage);
const WeeklyContentWriterLayout = withOwnerLayout(WeeklyContentWriterPage);
const OwnerToolDetailLayout = withOwnerLayout(OwnerToolDetailPage);
const OwnerToolsLayout = withOwnerLayout(OwnerToolsPage);
const OwnerSupportLayout = withOwnerLayout(OwnerSupportPage);

const AdminDashboardLayout = withAdminLayout(AdminDashboardPage);
const AdminManagementLayout = withAdminLayout(AdminManagementPage);
const AdminPlansLayout = withAdminLayout(AdminPlansPage);
const AdminStoreLayout = withAdminLayout(AdminStorePage);
const AdminStoreManagementLayout = withAdminLayout(AdminStoreManagementPage);
const AdminSupportChatLayout = withAdminLayout(AdminSupportChatPage);
const AdminSupportLayout = withAdminLayout(AdminSupportPage);
const AdminSettingsLayout = withAdminLayout(AdminSettingsPage);
const AdminTeamLayout = withAdminLayout(AdminTeamPage);
const AdminSalesLayout = withAdminLayout(AdminSalesPage);
const AdminApplicationsLayout = withAdminLayout(AdminApplicationsPage);
const AdminAnnouncementsLayout = withAdminLayout(AdminAnnouncementsPage);
const AdminWorkflowLayout = withAdminLayout(AdminWorkflowPage);
const AdminFinancialsPlansLayout = withAdminLayout(AdminFinancialsPlansPage);
const AdminFinancialsOrdersLayout = withAdminLayout(AdminFinancialsOrdersPage);
const AdminFinancialsDiscountsLayout = withAdminLayout(AdminFinancialsDiscountsPage);
const AdminFinancialsLayout = withAdminLayout(AdminFinancialsPage);

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

      <Route path="/owner/dashboard" component={OwnerDashboardLayout} />
      <Route path="/owner/menu" component={OwnerMenuLayout} />
      <Route path="/owner/offers" component={OwnerOffersLayout} />
      <Route path="/owner/customize" component={OwnerCustomizeLayout} />
      <Route path="/owner/branches" component={OwnerBranchesLayout} />
      <Route path="/owner/reviews" component={OwnerReviewsLayout} />
      <Route path="/owner/settings" component={OwnerSettingsLayout} />
      <Route path="/owner/store" component={OwnerStoreLayout} />
      <Route path="/owner/pricing" component={OwnerPricingLayout} />
      <Route path="/owner/tickets/:ticketId" component={OwnerTicketDetailLayout} />
      <Route path="/owner/tickets" component={OwnerTicketsLayout} />
      <Route path="/owner/tools/daily-pulse-dashboard" component={DailyPulseLayout} />
      <Route path="/owner/tools/marketing-calendar" component={MarketingCalendarLayout} />
      <Route path="/owner/tools/reply-templates" component={ReplyTemplatesLayout} />
      <Route path="/owner/tools/summarize-feedback" component={SummarizeFeedbackLayout} />
      <Route path="/owner/tools/weekly-content-writer" component={WeeklyContentWriterLayout} />
      <Route path="/owner/tools/:toolId" component={OwnerToolDetailLayout} />
      <Route path="/owner/tools" component={OwnerToolsLayout} />
      <Route path="/owner/support" component={OwnerSupportLayout} />
      <Route path="/owner" component={OwnerDashboardLayout} />

      <Route path="/admin/dashboard" component={AdminDashboardLayout} />
      <Route path="/admin/management" component={AdminManagementLayout} />
      <Route path="/admin/plans" component={AdminPlansLayout} />
      <Route path="/admin/store" component={AdminStoreLayout} />
      <Route path="/admin/store-management" component={AdminStoreManagementLayout} />
      <Route path="/admin/support/:chatId" component={AdminSupportChatLayout} />
      <Route path="/admin/support" component={AdminSupportLayout} />
      <Route path="/admin/settings" component={AdminSettingsLayout} />
      <Route path="/admin/team" component={AdminTeamLayout} />
      <Route path="/admin/sales" component={AdminSalesLayout} />
      <Route path="/admin/applications" component={AdminApplicationsLayout} />
      <Route path="/admin/announcements" component={AdminAnnouncementsLayout} />
      <Route path="/admin/workflow" component={AdminWorkflowLayout} />
      <Route path="/admin/financials/plans" component={AdminFinancialsPlansLayout} />
      <Route path="/admin/financials/orders" component={AdminFinancialsOrdersLayout} />
      <Route path="/admin/financials/discounts" component={AdminFinancialsDiscountsLayout} />
      <Route path="/admin/financials" component={AdminFinancialsLayout} />
      <Route path="/admin" component={AdminDashboardLayout} />

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
