import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Phone, Mail, MapPin, Calendar, CheckCircle, XCircle, Trash2, Edit } from "lucide-react";

interface AcceptedQuote {
  id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  quoted_by?: string;
  jobs_selected: any[];
  first_time: boolean;
  status: string;
  created_at: string;
  quoted_by_user?: {
    name: string;
  };
}

interface AcceptedQuotesProps {
  onConvertToJob?: (quote: AcceptedQuote) => void;
}

export default function AcceptedQuotes({ onConvertToJob }: AcceptedQuotesProps) {
  const [quotes, setQuotes] = useState<AcceptedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAcceptedQuotes();
  }, []);

  const fetchAcceptedQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from('accepted_quotes')
        .select(`
          *,
          quoted_by_user:users!quoted_by(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes((data || []).map(quote => ({
        ...quote,
        jobs_selected: Array.isArray(quote.jobs_selected) ? quote.jobs_selected : []
      })));
    } catch (error) {
      console.error('Error fetching accepted quotes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch accepted quotes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToJob = (quote: AcceptedQuote) => {
    if (onConvertToJob) {
      onConvertToJob(quote);
    }
  };

  const deleteQuote = async (quoteId: string) => {
    setDeleting(quoteId);
    try {
      const { error } = await supabase
        .from('accepted_quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;

      toast({
        title: "Quote Deleted",
        description: "Quote has been permanently deleted",
      });

      fetchAcceptedQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast({
        title: "Error",
        description: "Failed to delete quote",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const rejectQuote = async (quoteId: string) => {
    try {
      const { error } = await supabase
        .from('accepted_quotes')
        .update({ status: 'rejected' })
        .eq('id', quoteId);

      if (error) throw error;

      toast({
        title: "Quote Rejected",
        description: "Quote has been marked as rejected",
      });

      fetchAcceptedQuotes();
    } catch (error) {
      console.error('Error rejecting quote:', error);
      toast({
        title: "Error",
        description: "Failed to reject quote",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const pendingQuotes = quotes.filter(q => q.status === 'pending');
  const processedQuotes = quotes.filter(q => q.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Accepted Quotes</h2>
        <p className="text-muted-foreground">
          Convert accepted quotes from your website into jobs
        </p>
      </div>

      {pendingQuotes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Pending Conversion</h3>
          <div className="grid gap-4">
            {pendingQuotes.map((quote) => (
              <Card key={quote.id} className="border-l-4 border-l-yellow-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {quote.customer_name}
                        {quote.first_time && (
                          <Badge variant="secondary">First Time</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(quote.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">Pending</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {/* Customer Info */}
                    <div className="grid md:grid-cols-3 gap-2 text-sm">
                      {quote.customer_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {quote.customer_phone}
                        </div>
                      )}
                      {quote.customer_email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {quote.customer_email}
                        </div>
                      )}
                      {quote.customer_address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {quote.customer_address}
                        </div>
                      )}
                    </div>

                    {/* Quoted By */}
                    {quote.quoted_by_user && (
                      <div className="text-sm">
                        <span className="font-medium">Quoted by:</span> {quote.quoted_by_user.name}
                      </div>
                    )}

                    {/* Jobs Selected */}
                    <div>
                      <h4 className="font-medium mb-2">Selected Services ({quote.jobs_selected.length})</h4>
                      <div className="grid gap-2">
                        {quote.jobs_selected.map((job, index) => (
                          <div key={index} className="bg-muted/50 p-3 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">{job.title || job.name}</div>
                                {job.description && (
                                  <div className="text-sm text-muted-foreground">{job.description}</div>
                                )}
                              </div>
                              <div className="text-right">
                                {job.price && <div className="font-medium">${job.price}</div>}
                                {job.duration && <div className="text-sm text-muted-foreground">{job.duration} min</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleConvertToJob(quote)}
                        disabled={deleting === quote.id}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Convert to Job{quote.jobs_selected.length > 1 ? 's' : ''}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => rejectQuote(quote.id)}
                        disabled={deleting === quote.id}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => deleteQuote(quote.id)}
                        disabled={deleting === quote.id}
                        size="icon"
                      >
                        {deleting === quote.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {processedQuotes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Processed Quotes</h3>
          <div className="grid gap-4">
            {processedQuotes.map((quote) => (
              <Card key={quote.id} className={`opacity-60 ${quote.status === 'converted' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {quote.customer_name}
                    </CardTitle>
                    <Badge variant={quote.status === 'converted' ? 'default' : 'destructive'}>
                      {quote.status === 'converted' ? 'Converted' : 'Rejected'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      {quote.jobs_selected.length} service{quote.jobs_selected.length > 1 ? 's' : ''} • 
                      Processed on {new Date(quote.created_at).toLocaleDateString()}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteQuote(quote.id)}
                      disabled={deleting === quote.id}
                    >
                      {deleting === quote.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {quotes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground">No accepted quotes yet</div>
          <div className="text-sm text-muted-foreground mt-2">
            Quotes will appear here when received via webhook
          </div>
        </div>
      )}
    </div>
  );
}