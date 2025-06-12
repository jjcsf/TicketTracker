import { format } from 'date-fns';

export interface TicketListing {
  section: string;
  row: string;
  price: number;
  quantity: number;
  seller: string;
  marketplace: 'seatgeek' | 'stubhub';
  url?: string;
}

export interface GameTicketData {
  gameId: number;
  gameDate: string;
  opponent: string;
  venue: string;
  listings: TicketListing[];
}

class TicketApiService {
  private seatgeekClientId: string;
  private seatgeekClientSecret: string;
  private stubhubApiKey: string;

  constructor() {
    this.seatgeekClientId = process.env.SEATGEEK_CLIENT_ID || '';
    this.seatgeekClientSecret = process.env.SEATGEEK_CLIENT_SECRET || '';
    this.stubhubApiKey = process.env.STUBHUB_API_KEY || '';
  }

  private async getSeatGeekAccessToken(): Promise<string> {
    if (!this.seatgeekClientId || !this.seatgeekClientSecret) {
      throw new Error('SeatGeek credentials not configured');
    }

    const response = await fetch('https://api.seatgeek.com/2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.seatgeekClientId,
        client_secret: this.seatgeekClientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`SeatGeek authentication failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async fetchSeatGeekListings(
    teamName: string,
    opponent: string,
    gameDate: string,
    targetSection: string
  ): Promise<TicketListing[]> {
    try {
      const accessToken = await this.getSeatGeekAccessToken();
      
      // Search for events matching the criteria
      const eventSearchUrl = new URL('https://api.seatgeek.com/2/events');
      eventSearchUrl.searchParams.set('performers.slug', teamName.toLowerCase().replace(/\s+/g, '-'));
      eventSearchUrl.searchParams.set('datetime_utc.gte', format(new Date(gameDate), 'yyyy-MM-dd'));
      eventSearchUrl.searchParams.set('datetime_utc.lte', format(new Date(gameDate), 'yyyy-MM-dd'));
      
      const eventResponse = await fetch(eventSearchUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!eventResponse.ok) {
        throw new Error(`SeatGeek event search failed: ${eventResponse.statusText}`);
      }

      const eventData = await eventResponse.json();
      const events = eventData.events || [];
      
      if (events.length === 0) {
        return [];
      }

      const event = events[0];
      
      // Fetch listings for the event
      const listingsUrl = new URL(`https://api.seatgeek.com/2/events/${event.id}/listings`);
      listingsUrl.searchParams.set('section', targetSection);
      
      const listingsResponse = await fetch(listingsUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!listingsResponse.ok) {
        throw new Error(`SeatGeek listings fetch failed: ${listingsResponse.statusText}`);
      }

      const listingsData = await listingsResponse.json();
      const listings = listingsData.listings || [];

      return listings.map((listing: any): TicketListing => ({
        section: listing.section || targetSection,
        row: listing.row || 'Unknown',
        price: listing.price || 0,
        quantity: listing.quantity || 1,
        seller: 'SeatGeek',
        marketplace: 'seatgeek',
        url: listing.url,
      }));
    } catch (error) {
      console.error('SeatGeek API error:', error);
      return [];
    }
  }

  async fetchStubHubListings(
    teamName: string,
    opponent: string,
    gameDate: string,
    targetSection: string
  ): Promise<TicketListing[]> {
    try {
      if (!this.stubhubApiKey) {
        throw new Error('StubHub API key not configured');
      }

      // Search for events
      const eventSearchUrl = new URL('https://api.stubhub.com/search/catalog/events/v3');
      eventSearchUrl.searchParams.set('performers', teamName);
      eventSearchUrl.searchParams.set('minDate', format(new Date(gameDate), 'yyyy-MM-dd'));
      eventSearchUrl.searchParams.set('maxDate', format(new Date(gameDate), 'yyyy-MM-dd'));
      
      const eventResponse = await fetch(eventSearchUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${this.stubhubApiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!eventResponse.ok) {
        throw new Error(`StubHub event search failed: ${eventResponse.statusText}`);
      }

      const eventData = await eventResponse.json();
      const events = eventData.events || [];
      
      if (events.length === 0) {
        return [];
      }

      const event = events[0];
      
      // Fetch inventory for the event
      const inventoryUrl = new URL(`https://api.stubhub.com/search/inventory/v2`);
      inventoryUrl.searchParams.set('eventId', event.id.toString());
      inventoryUrl.searchParams.set('section', targetSection);
      
      const inventoryResponse = await fetch(inventoryUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${this.stubhubApiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!inventoryResponse.ok) {
        throw new Error(`StubHub inventory fetch failed: ${inventoryResponse.statusText}`);
      }

      const inventoryData = await inventoryResponse.json();
      const listings = inventoryData.listing || [];

      return listings.map((listing: any): TicketListing => ({
        section: listing.sectionName || targetSection,
        row: listing.row || 'Unknown',
        price: listing.currentPrice?.amount || 0,
        quantity: listing.quantity || 1,
        seller: 'StubHub',
        marketplace: 'stubhub',
        url: listing.webUrl,
      }));
    } catch (error) {
      console.error('StubHub API error:', error);
      return [];
    }
  }

  async fetchSimilarSectionListings(
    teamName: string,
    opponent: string,
    gameDate: string,
    targetSection: string,
    adjacentSections: string[] = []
  ): Promise<TicketListing[]> {
    const allListings: TicketListing[] = [];
    const sectionsToSearch = [targetSection, ...adjacentSections];

    // Fetch from both marketplaces for all relevant sections
    for (const section of sectionsToSearch) {
      const [seatgeekListings, stubhubListings] = await Promise.allSettled([
        this.fetchSeatGeekListings(teamName, opponent, gameDate, section),
        this.fetchStubHubListings(teamName, opponent, gameDate, section),
      ]);

      if (seatgeekListings.status === 'fulfilled') {
        allListings.push(...seatgeekListings.value);
      }

      if (stubhubListings.status === 'fulfilled') {
        allListings.push(...stubhubListings.value);
      }
    }

    // Sort by price ascending
    return allListings.sort((a, b) => a.price - b.price);
  }

  async getMarketDataForGame(
    teamName: string,
    opponent: string,
    gameDate: string,
    targetSection: string
  ): Promise<GameTicketData> {
    // Generate similar sections (basic logic - could be enhanced)
    const sectionNumber = parseInt(targetSection);
    const adjacentSections = [];
    
    if (!isNaN(sectionNumber)) {
      adjacentSections.push(
        (sectionNumber - 1).toString(),
        (sectionNumber + 1).toString()
      );
    }

    const listings = await this.fetchSimilarSectionListings(
      teamName,
      opponent,
      gameDate,
      targetSection,
      adjacentSections
    );

    return {
      gameId: 0, // Will be set by caller
      gameDate,
      opponent,
      venue: `${teamName} Stadium`, // Default venue name
      listings,
    };
  }

  isConfigured(): boolean {
    return (
      (!!this.seatgeekClientId && !!this.seatgeekClientSecret) ||
      !!this.stubhubApiKey
    );
  }

  getConfigurationStatus(): {
    seatgeek: boolean;
    stubhub: boolean;
    anyConfigured: boolean;
  } {
    return {
      seatgeek: !!(this.seatgeekClientId && this.seatgeekClientSecret),
      stubhub: !!this.stubhubApiKey,
      anyConfigured: this.isConfigured(),
    };
  }
}

export const ticketApiService = new TicketApiService();