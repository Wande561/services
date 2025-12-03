import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Wallet as WalletIcon, 
  Send, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy,
  ExternalLink,
  Coins,
  Gift,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Principal } from '@dfinity/principal';
import type { Account, Tokens } from '../../../declarations/kotomo/kotomo.did';
import '../styles/wallet.css';

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  fee: number;
}

interface Transaction {
  id: number;
  type: 'receive' | 'send';
  amount: number;
  from?: string;
  to?: string;
  timestamp: Date;
  status: 'completed' | 'pending' | 'failed';
}

interface TransferData {
  recipient: string;
  amount: string;
  memo: string;
}

interface GiftRecipient {
  principal: string;
  amount: string;
}

interface GiftData {
  recipients: GiftRecipient[];
  memo: string;
}

const Wallet: React.FC = () => {
  const { 
    user, 
    isConnected, 
    tokenBalance,
    tokenMetadata,
    kotomoActor,
    getTokenBalance,
    getTokenMetadata,
    transferTokens,
    getTokenSymbol,
    getTokenName,
    getTokenDecimals,
    getTokenFee,
    refreshTokenBalance
  } = useApp();
  
  // Wallet state
  const [balance, setBalance] = useState<number>(0);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    name: '',
    symbol: '',
    decimals: 0,
    fee: 0
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [showTransferForm, setShowTransferForm] = useState<boolean>(false);
  const [transferData, setTransferData] = useState<TransferData>({
    recipient: '',
    amount: '',
    memo: ''
  });

  const [showGiftForm, setShowGiftForm] = useState<boolean>(false);
  const [giftData, setGiftData] = useState<GiftData>({
    recipients: [{ principal: '', amount: '' }],
    memo: ''
  });

  useEffect(() => {
    if (isConnected && user.principal) {
      loadWalletData();
    }
  }, [isConnected, user.principal]);

  const loadWalletData = async (): Promise<void> => {
    setLoading(true);
    try {
      await Promise.all([
        loadTokenInfo(),
        loadBalance(),
        loadTransactionHistory()
      ]);
    } catch (err) {
      setError('Failed to load wallet data: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadTokenInfo = async (): Promise<void> => {
    try {
      if (!kotomoActor) {
        setTokenInfo({
          name: 'Loading...',
          symbol: 'KOTOMO',
          decimals: 8,
          fee: 0.0001
        });
        return;
      }
      
      const [name, symbol, decimals, fee] = await Promise.all([
        getTokenName(),
        getTokenSymbol(), 
        getTokenDecimals(),
        getTokenFee()
      ]);
      
      setTokenInfo({
        name,
        symbol,
        decimals,
        fee: Number(fee) / Math.pow(10, decimals)
      });
    } catch (error) {
      console.error('Failed to load token info:', error);
      setTokenInfo({
        name: 'Kotomo Token',
        symbol: 'KOTOMO',
        decimals: 8,
        fee: 0.0001
      });
    }
  };

  const loadBalance = async (): Promise<void> => {
    if (!user.principal) return;
    
    try {
      if (tokenBalance !== null) {
        const decimalsFromTokenInfo = tokenInfo.decimals || 8;
        const balanceDecimal = Number(tokenBalance) / Math.pow(10, decimalsFromTokenInfo);
        setBalance(balanceDecimal);
      } else if (kotomoActor) {
        const balanceResult = await getTokenBalance();
        const decimalsFromTokenInfo = tokenInfo.decimals || 8;
        const balanceDecimal = Number(balanceResult) / Math.pow(10, decimalsFromTokenInfo);
        setBalance(balanceDecimal);
      } else {
        setBalance(0);
      }
    } catch (error) {
      console.error('Failed to load balance:', error);
      setBalance(0);
    }
  };

  const loadTransactionHistory = async (): Promise<void> => {
    try {
      // TODO: Implement real transaction history once indexer/transaction service is available
      // The ICRC-1 standard doesn't include transaction history methods
      // This will need to be implemented with a separate indexer service or backend method
      setTransactions([]);
    } catch (error) {
      console.error('Failed to load transaction history:', error);
      setTransactions([]);
    }
  };

  const handleTransfer = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (!transferData.recipient || !transferData.amount) {
        throw new Error('Please fill in all required fields');
      }
      
      if (parseFloat(transferData.amount) <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      
      if (parseFloat(transferData.amount) > balance) {
        throw new Error('Insufficient balance');
      }

      if (!kotomoActor) {
        throw new Error('Kotomo token canister not connected');
      }

      const toAccount: Account = {
        owner: Principal.fromText(transferData.recipient),
        subaccount: []
      };
      
      const amount = BigInt(Math.floor(parseFloat(transferData.amount) * Math.pow(10, tokenInfo.decimals)));
      const memo = transferData.memo ? new TextEncoder().encode(transferData.memo) : undefined;
      
      const result = await transferTokens(toAccount, amount, memo);
      
      if ('Ok' in result) {
        // Success
        setTransferData({ recipient: '', amount: '', memo: '' });
        setShowTransferForm(false);
        await loadWalletData(); // Refresh data
        setError(''); // Clear any previous errors
      } else {
        // Error
        const errorMsg = 'Err' in result && result.Err ? JSON.stringify(result.Err) : 'Unknown error';
        throw new Error(`Transfer failed: ${errorMsg}`);
      }
      
    } catch (err) {
      setError('Transfer failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchGift = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Batch gift functionality temporarily disabled - can be implemented later with multiple transferTokens calls
      console.log('Batch gift functionality not yet implemented with kotomo');
      setError('Batch gift functionality not yet implemented with kotomo token');
      return;
      
    } catch (err) {
      setError('Batch gift failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const addGiftRecipient = (): void => {
    setGiftData(prev => ({
      ...prev,
      recipients: [...prev.recipients, { principal: '', amount: '' }]
    }));
  };

  const removeGiftRecipient = (index: number): void => {
    setGiftData(prev => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index)
    }));
  };

  const updateGiftRecipient = (index: number, field: keyof GiftRecipient, value: string): void => {
    setGiftData(prev => ({
      ...prev,
      recipients: prev.recipients.map((recipient, i) => 
        i === index ? { ...recipient, [field]: value } : recipient
      )
    }));
  };

  const copyPrincipal = (): void => {
    if (user.principal) {
      navigator.clipboard.writeText(user.principal.toText());
    }
  };

  const refreshBalance = async (): Promise<void> => {
    setLoading(true);
    try {
      if (refreshTokenBalance) {
        await refreshTokenBalance();
      }
      await loadBalance();
    } catch (err) {
      setError('Failed to refresh balance: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatTokenAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    }).format(amount);
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (!isConnected) {
    return (
      <div className="wallet-container">
        <div className="wallet-header">
          <div className="wallet-header-content">
            <WalletIcon className="wallet-icon" />
            <div>
              <h1>Wallet</h1>
              <p>Manage your ENG tokens</p>
            </div>
          </div>
        </div>
        
        <div className="wallet-content">
          <div className="connect-prompt">
            <WalletIcon size={48} />
            <h3>Connect Your Wallet</h3>
            <p>Please connect with Internet Identity to access your wallet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-container">
      <div className="wallet-header">
        <div className="wallet-header-content">
          <WalletIcon className="wallet-icon" />
          <div>
            <h1>Wallet</h1>
            <p>Manage your {tokenInfo.symbol} tokens</p>
          </div>
        </div>
        
        <div className="wallet-actions">
          <button 
            className="btn btn-outline"
            onClick={() => setShowTransferForm(!showTransferForm)}
          >
            <Send size={16} />
            Send
          </button>
          <button 
            className="btn btn-outline"
            onClick={() => setShowGiftForm(!showGiftForm)}
          >
            <Gift size={16} />
            Gift
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="wallet-content">
        {/* Balance Card */}
        <motion.div 
          className="wallet-balance-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="balance-header">
            <Coins className="balance-icon" />
            <div>
              <h3>Total Balance</h3>
              <p>Your {tokenInfo.name} holdings</p>
            </div>
            <button 
              onClick={refreshBalance} 
              className="refresh-btn"
              disabled={loading}
              title="Refresh balance"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          
          <div className="balance-amount">
            <span className="amount">{formatTokenAmount(balance)}</span>
            <span className="symbol">{tokenInfo.symbol}</span>
          </div>
          
          <div className="wallet-info">
            <div className="info-item">
              <span className="label">Your Principal</span>
              <div className="principal-display">
                <span className="principal-text">
                  {user.principal ? user.principal.toText().slice(0, 20) + '...' : 'Loading...'}
                </span>
                <button onClick={copyPrincipal} className="copy-btn">
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div className="info-item">
              <span className="label">Network Fee</span>
              <span className="value">{tokenInfo.fee} {tokenInfo.symbol}</span>
            </div>
          </div>
        </motion.div>

        {/* Transfer Form */}
        {showTransferForm && (
          <motion.div 
            className="wallet-form-card"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3>Send Tokens</h3>
            <form onSubmit={handleTransfer}>
              <div className="form-group">
                <label>Recipient Principal</label>
                <input
                  type="text"
                  placeholder="Enter recipient's principal ID"
                  value={transferData.recipient}
                  onChange={(e) => setTransferData(prev => ({ ...prev, recipient: e.target.value }))}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Amount ({tokenInfo.symbol})</label>
                <input
                  type="number"
                  step="0.00000001"
                  placeholder="0.00"
                  value={transferData.amount}
                  onChange={(e) => setTransferData(prev => ({ ...prev, amount: e.target.value }))}
                  max={balance}
                  required
                />
                <div className="balance-info">
                  Available: {formatTokenAmount(balance)} {tokenInfo.symbol}
                </div>
              </div>
              
              <div className="form-group">
                <label>Memo (Optional)</label>
                <input
                  type="text"
                  placeholder="Add a note..."
                  value={transferData.memo}
                  onChange={(e) => setTransferData(prev => ({ ...prev, memo: e.target.value }))}
                />
              </div>
              
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowTransferForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Tokens'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Batch Gift Form */}
        {showGiftForm && (
          <motion.div 
            className="wallet-form-card"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3>Gift Tokens (Batch)</h3>
            <form onSubmit={handleBatchGift}>
              {giftData.recipients.map((recipient, index) => (
                <div key={index} className="recipient-group">
                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Recipient {index + 1} Principal</label>
                      <input
                        type="text"
                        placeholder="Principal ID"
                        value={recipient.principal}
                        onChange={(e) => updateGiftRecipient(index, 'principal', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Amount</label>
                      <input
                        type="number"
                        step="0.00000001"
                        placeholder="0.00"
                        value={recipient.amount}
                        onChange={(e) => updateGiftRecipient(index, 'amount', e.target.value)}
                      />
                    </div>
                    {giftData.recipients.length > 1 && (
                      <button 
                        type="button" 
                        className="remove-recipient-btn"
                        onClick={() => removeGiftRecipient(index)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              <button type="button" className="btn btn-outline btn-small" onClick={addGiftRecipient}>
                <Plus size={16} />
                Add Recipient
              </button>
              
              <div className="form-group">
                <label>Gift Message (Optional)</label>
                <input
                  type="text"
                  placeholder="Add a gift message..."
                  value={giftData.memo}
                  onChange={(e) => setGiftData(prev => ({ ...prev, memo: e.target.value }))}
                />
              </div>
              
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowGiftForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Sending Gifts...' : 'Send Gifts'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Transaction History */}
        <motion.div 
          className="wallet-transactions-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="transactions-header">
            <h3>Recent Transactions</h3>
            <button className="btn btn-ghost">
              <ExternalLink size={16} />
              View All
            </button>
          </div>
          
          <div className="transactions-list">
            {transactions.length === 0 ? (
              <div className="no-transactions">
                <p>No transactions yet</p>
              </div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="transaction-item">
                  <div className="transaction-icon">
                    {tx.type === 'receive' ? (
                      <ArrowDownLeft className="receive-icon" />
                    ) : (
                      <ArrowUpRight className="send-icon" />
                    )}
                  </div>
                  
                  <div className="transaction-details">
                    <div className="transaction-title">
                      {tx.type === 'receive' ? `Received from ${tx.from}` : `Sent to ${tx.to}`}
                    </div>
                    <div className="transaction-date">
                      {formatDate(tx.timestamp)}
                    </div>
                  </div>
                  
                  <div className="transaction-amount">
                    <span className={`amount ${tx.type}`}>
                      {tx.type === 'receive' ? '+' : '-'}{formatTokenAmount(tx.amount)}
                    </span>
                    <span className="symbol">{tokenInfo.symbol}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Wallet;
