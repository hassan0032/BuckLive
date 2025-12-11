import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// --- Helper Functions ---
function formatYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addYears(ymd: string, years: number): string {
  const date = new Date(ymd);
  date.setFullYear(date.getFullYear() + years);
  return formatYMD(date);
}

function parseYMD(ymd: string): Date {
  return new Date(ymd + "T00:00:00Z");
}

function daysBetween(startDate: string, endDate: string): number {
  const start = parseYMD(startDate);
  const end = parseYMD(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate the next occurrence of billing_date (month/day) from a given date
function getNextBillingDate(billingDate: string, fromDate: string): string {
  const billing = parseYMD(billingDate);
  const from = parseYMD(fromDate);
  
  const billingMonth = billing.getUTCMonth();
  const billingDay = billing.getUTCDate();
  let year = from.getUTCFullYear();
  
  // Try to construct date in current year
  let nextDate = new Date(Date.UTC(year, billingMonth, billingDay));
  
  // Handle invalid dates (e.g., Feb 29 on non-leap years)
  if (nextDate.getUTCMonth() !== billingMonth) {
    // Day overflowed to next month, use last day of intended month
    nextDate = new Date(Date.UTC(year, billingMonth + 1, 0));
  }
  
  // If the date has already passed this year, use next year
  if (nextDate <= from) {
    year++;
    nextDate = new Date(Date.UTC(year, billingMonth, billingDay));
    if (nextDate.getUTCMonth() !== billingMonth) {
      nextDate = new Date(Date.UTC(year, billingMonth + 1, 0));
    }
  }
  
  return formatYMD(nextDate);
}

// Helper function to calculate discount percentage based on community count
function getDiscountPercentage(communityCount: number): number {
  if (communityCount >= 20) return 40;
  if (communityCount >= 10) return 36;
  if (communityCount >= 6) return 30;
  switch (communityCount) {
    case 5: return 20;
    case 4: return 15;
    case 3: return 10;
    case 2: return 5;
    default: return 0;
  }
}

// Calculate prorated amount
function calculateProratedAmount(days: number, baseAmountCents: number): number {
  return Math.round((days / 365) * baseAmountCents);
}

// Apply discount to amount
function applyDiscount(amountCents: number, discountPercentage: number): number {
  return Math.round(amountCents * (1 - discountPercentage / 100));
}

/**
 * BUCK LIVE COMMUNITY MANAGER INVOICING (v1.0 - FINAL)
 * 
 * Rules:
 * 1. Billing starts on first login → billing_date set on first login
 * 2. First invoice issued the night after first login
 * 3. period_start = invoice issue date (today)
 * 4. period_end = next occurrence of manager's billing_date
 * 5. amount_cents = pre-discount amount (list price)
 * 6. Discount applied only in frontend and PDF for flexibility
 * 7. All future invoices align to same annual date
 */

// --- Main Function ---
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow POST for manual trigger
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Supabase Admin Client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date();
    const todayYMD = formatYMD(today);
    console.log(`Running yearly invoice generator for ${todayYMD}`);

    const results = {
      renewalInvoicesCreated: 0,
      newCommunityInvoicesCreated: 0,
      skippedNoBillingDate: 0,
      errors: [] as string[],
    };

    // =========================================================================
    // PART 1: Handle RENEWAL invoices (existing communities with expiring invoices)
    // =========================================================================
    console.log("--- PART 1: Processing Renewal Invoices ---");

    const { data: expiringInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select("*, community:community_id(id, name, membership_tier, primary_manager, organization_id, created_at)")
      .eq("period_end", todayYMD);

    if (fetchError) {
      console.error("Error fetching expiring invoices:", fetchError);
      results.errors.push(`Failed to fetch expiring invoices: ${fetchError.message}`);
    } else if (expiringInvoices && expiringInvoices.length > 0) {
      console.log(`Found ${expiringInvoices.length} expiring invoices.`);

      for (const inv of expiringInvoices) {
        const community = inv.community;
        const tier = community?.membership_tier as 'gold' | 'silver' | undefined;
        const communityName = community?.name;
        const communityId = inv.community_id;
        const primaryManagerId = community?.primary_manager;
        const organizationId = community?.organization_id;
        const baseAmount = tier === 'gold' ? 500000 : 250000;

        if (!communityId) {
          console.log(`Skipping invoice without community_id`);
          continue;
        }

        // Get manager info and discount based on whether this is an org or standalone community
        let managerEmail: string | null = null;
        let managerName: string | null = null;
        let discountPercentage = 0;
        let periodEnd = addYears(todayYMD, 1); // fallback
        let daysInPeriod = 365;

        if (organizationId) {
          // ORGANIZATION COMMUNITY - use org's billing date and org-based discount
          console.log(`Processing renewal for org community: ${communityName}`);

          // Get organization billing date
          const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("billing_date")
            .eq("id", organizationId)
            .single();

          if (!orgError && org?.billing_date) {
            periodEnd = getNextBillingDate(org.billing_date, todayYMD);
            daysInPeriod = daysBetween(todayYMD, periodEnd);
          }

          // Count total communities in this organization for discount
          const { count, error: countError } = await supabase
            .from("communities")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId);

          if (!countError) {
            discountPercentage = getDiscountPercentage(count || 0);
            console.log(`Organization ${organizationId} has ${count} communities, discount: ${discountPercentage}%`);
          }

          // Get primary community manager for this community (for invoice metadata)
          const { data: cmData, error: cmError } = await supabase
            .from("community_managers")
            .select("user_id")
            .eq("community_id", communityId)
            .limit(1)
            .maybeSingle();

          if (!cmError && cmData) {
            const { data: managerProfile, error: managerError } = await supabase
              .from("user_profiles")
              .select("email, first_name, last_name")
              .eq("id", cmData.user_id)
              .single();

            if (!managerError && managerProfile) {
              managerEmail = managerProfile.email;
              managerName = `${managerProfile.first_name || ''} ${managerProfile.last_name || ''}`.trim() || null;
            }
          }

        } else if (primaryManagerId) {
          // STANDALONE COMMUNITY - use primary manager's billing date and manager-based discount
          console.log(`Processing renewal for standalone community: ${communityName}`);

          // Get manager profile
          const { data: managerProfile, error: managerError } = await supabase
            .from("user_profiles")
            .select("email, first_name, last_name, billing_date")
            .eq("id", primaryManagerId)
            .single();

          if (!managerError && managerProfile) {
            managerEmail = managerProfile.email;
            managerName = `${managerProfile.first_name || ''} ${managerProfile.last_name || ''}`.trim() || null;

            // Calculate period end based on manager's billing date
            if (managerProfile.billing_date) {
              periodEnd = getNextBillingDate(managerProfile.billing_date, todayYMD);
              daysInPeriod = daysBetween(todayYMD, periodEnd);
            }
          }

          // Count how many communities this primary_manager manages for discount
          const { count, error: countError } = await supabase
            .from("communities")
            .select("id", { count: "exact", head: true })
            .eq("primary_manager", primaryManagerId);

          if (!countError) {
            discountPercentage = getDiscountPercentage(count || 0);
            console.log(`Primary manager ${primaryManagerId} has ${count} communities, discount: ${discountPercentage}%`);
          }
        }
        
        // Apply proration if the period is less than 365 days (not a full year)
        const isProrated = daysInPeriod < 364;
        const proratedDays = daysInPeriod;

        // Calculate amount - prorate if period is less than 364 days
        const amountBeforeDiscount = isProrated
          ? calculateProratedAmount(proratedDays, baseAmount)
          : baseAmount;
        
        console.log(`DEBUG: daysInPeriod=${daysInPeriod}, isProrated=${isProrated}, proratedDays=${proratedDays}, baseAmount=${baseAmount}, calculatedProrated=${calculateProratedAmount(proratedDays, baseAmount)}, amountBeforeDiscount=${amountBeforeDiscount}`);

        // Apply discount AFTER proration
        const finalAmount = applyDiscount(amountBeforeDiscount, discountPercentage);

        console.log(`Renewal: Community=${communityName ?? 'unknown'}, tier=${tier ?? 'unknown'}, periodStart=${todayYMD}, periodEnd=${periodEnd}, daysInPeriod=${daysInPeriod}, isProrated=${isProrated}, amount_cents=${baseAmount}, discount=${discountPercentage}%, finalAmount=${finalAmount}`);

        const { error: insertError } = await supabase.from("invoices").insert({
          issue_date: todayYMD,
          period_start: todayYMD,
          period_end: periodEnd,
          amount_cents: amountBeforeDiscount,
          full_year_amount_cents: baseAmount,
          currency: 'USD',
          status: 'issued',
          community_id: communityId,
          discount_percentage: discountPercentage,
          community_manager_email: managerEmail,
          community_manager_name: managerName,
          is_prorated: isProrated,
          prorated_days: proratedDays,
        });

        if (insertError) {
          console.error(`Error creating renewal invoice for community ${communityId}:`, insertError);
          results.errors.push(`Failed to create renewal invoice for ${communityName}: ${insertError.message}`);
        } else {
          results.renewalInvoicesCreated++;
        }
      }
    } else {
      console.log("No invoices expiring today.");
    }

    // =========================================================================
    // PART 2: Handle NEW community invoices (communities without any invoice)
    // =========================================================================
    console.log("--- PART 2: Processing New Community Invoices ---");

    // Find active communities that don't have any invoice
    const { data: allCommunities, error: communitiesError } = await supabase
      .from("communities")
      .select("id, name, membership_tier, primary_manager, organization_id, created_at")
      .eq("is_active", true);

    if (communitiesError) {
      console.error("Error fetching communities:", communitiesError);
      results.errors.push(`Failed to fetch communities: ${communitiesError.message}`);
    } else if (allCommunities && allCommunities.length > 0) {
      // Get all community IDs that already have invoices
      const { data: invoicedCommunities, error: invoicedError } = await supabase
        .from("invoices")
        .select("community_id")
        .not("community_id", "is", null);

      if (invoicedError) {
        console.error("Error fetching invoiced communities:", invoicedError);
        results.errors.push(`Failed to fetch invoiced communities: ${invoicedError.message}`);
      } else {
        const invoicedCommunityIds = new Set(
          (invoicedCommunities || []).map((i) => i.community_id)
        );

        // Filter to communities without any invoice
        const communitiesWithoutInvoice = allCommunities.filter(
          (c) => !invoicedCommunityIds.has(c.id)
        );

        console.log(`Found ${communitiesWithoutInvoice.length} communities without invoices.`);

        for (const community of communitiesWithoutInvoice) {
          const { id: communityId, name: communityName, membership_tier: tier, primary_manager: primaryManagerId, organization_id: organizationId, created_at: communityCreatedAt } = community;
          const baseAmount = tier === 'gold' ? 500000 : 250000;

          let managerEmail: string | null = null;
          let managerName: string | null = null;
          let billingDate: string | null = null;
          let discountPercentage = 0;

          if (organizationId) {
            // ORGANIZATION COMMUNITY
            console.log(`Processing new invoice for org community: ${communityName}`);

            // Get organization billing date
            const { data: org, error: orgError } = await supabase
              .from("organizations")
              .select("billing_date")
              .eq("id", organizationId)
              .single();

            if (orgError || !org) {
              console.error(`Error fetching organization for ${organizationId}:`, orgError);
              results.errors.push(`Failed to fetch organization for community ${communityName}`);
              continue;
            }

            billingDate = org.billing_date;

            // Count total communities in this organization for discount
            const { count: communityCount, error: countError } = await supabase
              .from("communities")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", organizationId);

            discountPercentage = countError ? 0 : getDiscountPercentage(communityCount || 0);

            // Get community manager for this community (for invoice metadata)
            const { data: cmData, error: cmError } = await supabase
              .from("community_managers")
              .select("user_id")
              .eq("community_id", communityId)
              .limit(1)
              .maybeSingle();

            if (!cmError && cmData) {
              const { data: managerProfile, error: managerError } = await supabase
                .from("user_profiles")
                .select("email, first_name, last_name")
                .eq("id", cmData.user_id)
                .single();

              if (!managerError && managerProfile) {
                managerEmail = managerProfile.email;
                managerName = `${managerProfile.first_name || ''} ${managerProfile.last_name || ''}`.trim() || null;
              }
            }

          } else if (primaryManagerId) {
            // STANDALONE COMMUNITY
            console.log(`Processing new invoice for standalone community: ${communityName}`);

            // Get primary manager profile including billing_date
            const { data: managerProfile, error: managerError } = await supabase
              .from("user_profiles")
              .select("email, first_name, last_name, billing_date")
              .eq("id", primaryManagerId)
              .single();

            if (managerError || !managerProfile) {
              console.error(`Error fetching manager profile for ${primaryManagerId}:`, managerError);
              results.errors.push(`Failed to fetch manager profile for community ${communityName}`);
              continue;
            }

            // CRITICAL: Skip if billing_date is NULL (manager hasn't logged in yet)
            if (!managerProfile.billing_date) {
              console.log(`Skipping community ${communityName}: Manager billing_date is NULL (waiting for first login).`);
              results.skippedNoBillingDate++;
              continue;
            }

            managerEmail = managerProfile.email;
            managerName = `${managerProfile.first_name || ''} ${managerProfile.last_name || ''}`.trim() || null;
            billingDate = managerProfile.billing_date;

            // Count total communities for this manager for discount calculation
            const { count: communityCount, error: countError } = await supabase
              .from("communities")
              .select("id", { count: "exact", head: true })
              .eq("primary_manager", primaryManagerId);

            discountPercentage = countError ? 0 : getDiscountPercentage(communityCount || 0);

          } else {
            // No primary_manager and no organization_id - skip
            console.log(`Skipping community ${communityName}: No primary_manager or organization assigned.`);
            results.skippedNoBillingDate++;
            continue;
          }

          // Now we have billingDate (from org or manager), calculate period
          if (!billingDate) {
            console.log(`Skipping community ${communityName}: No billing date available.`);
            results.skippedNoBillingDate++;
            continue;
          }

          // Calculate period end based on billing date
          const periodEnd = getNextBillingDate(billingDate, todayYMD);
          const daysInPeriod = daysBetween(todayYMD, periodEnd);

          console.log(`DEBUG: community=${communityName}, billingDate=${billingDate}, periodStart=${todayYMD}, periodEnd=${periodEnd}, daysInPeriod=${daysInPeriod}`);

          // Apply proration if the period is less than 365 days (not a full year)
          const isProrated = daysInPeriod < 364;
          const proratedDays = daysInPeriod;

          // Calculate amount - prorate if period is less than 364 days
          const amountBeforeDiscount = isProrated
            ? calculateProratedAmount(proratedDays, baseAmount)
            : baseAmount;

          console.log(`DEBUG: daysInPeriod=${daysInPeriod}, isProrated=${isProrated}, proratedDays=${proratedDays}, baseAmount=${baseAmount}, calculatedProrated=${calculateProratedAmount(proratedDays, baseAmount)}, amountBeforeDiscount=${amountBeforeDiscount}`);

          // Apply discount AFTER proration
          const finalAmount = applyDiscount(amountBeforeDiscount, discountPercentage);

          console.log(`New Invoice: Community=${communityName}, tier=${tier}, periodStart=${todayYMD}, periodEnd=${periodEnd}, daysInPeriod=${daysInPeriod}, isProrated=${isProrated}, proratedDays=${proratedDays}, amount_cents=${amountBeforeDiscount}, discount=${discountPercentage}%, finalAmount=${finalAmount}`);

          const { error: insertError } = await supabase.from("invoices").insert({
            issue_date: todayYMD,
            period_start: todayYMD,
            period_end: periodEnd,
            amount_cents: amountBeforeDiscount, // Store amount WITHOUT discount
            full_year_amount_cents: baseAmount,
            currency: 'USD',
            status: 'issued',
            community_id: communityId,
            discount_percentage: discountPercentage,
            community_manager_email: managerEmail,
            community_manager_name: managerName,
            is_prorated: isProrated,
            prorated_days: proratedDays,
          });

          if (insertError) {
            console.error(`Error creating invoice for community ${communityId}:`, insertError);
            results.errors.push(`Failed to create invoice for ${communityName}: ${insertError.message}`);
          } else {
            results.newCommunityInvoicesCreated++;
          }
        }
      }
    }

    // =========================================================================
    // Summary
    // =========================================================================
    const totalCreated = results.renewalInvoicesCreated + results.newCommunityInvoicesCreated;
    console.log(`✅ Summary: Renewal=${results.renewalInvoicesCreated}, NewCommunity=${results.newCommunityInvoicesCreated}, SkippedNoBillingDate=${results.skippedNoBillingDate}, Errors=${results.errors.length}`);

    return new Response(
      JSON.stringify({
        message: "Invoice generation completed",
        renewalInvoicesCreated: results.renewalInvoicesCreated,
        newCommunityInvoicesCreated: results.newCommunityInvoicesCreated,
        skippedNoBillingDate: results.skippedNoBillingDate,
        totalCreated,
        errors: results.errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("🔥 Error in generate-yearly-invoices function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
