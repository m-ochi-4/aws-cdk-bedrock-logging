
import { EnvNamePropsMapping } from './index'

export const envNamePropsMapping: EnvNamePropsMapping = {};
envNamePropsMapping['Management'] = {
  // StackSet 作成リソースの名前につける接頭辞
  resourcePrefix: 'aws-bedrock-logs',
  // PutModelInvocationLoggingConfiguration API の同名パラメタへ渡す値
  // 参考: https://docs.aws.amazon.com/ja_jp/bedrock/latest/APIReference/API_PutModelInvocationLoggingConfiguration.html
  textDataDeliveryEnabled: true,
  imageDataDeliveryEnabled: true,
  embeddingDataDeliveryEnabled: true,
  // 自組織 ID
  orgId: 'o-0000000000',
  // OU ルート ID
  orgRootId: 'r-0000',
  // ログ集約アカウントの ID および S3 バケット作成リージョン名
  logsAggregationAccountId: '000000000000',
  logsAggregationAccountRegion: 'us-east-1',
  // Bedrock モデル実行ログ 有効化対象アカウント
  // 参考: https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/aws-properties-cloudformation-stackset-stackinstances.html
  modelInvocationLoggingAccounts: [
    {
      deploymentTargets: {
        organizationalUnitIds: ['r-0000',],
        accountFilterType: 'INTERSECTION',
        accounts: ['000000000000', '000000000000', ],
      },
      regions: ['us-east-1', 'us-west-2', 'ap-northeast-1',],
    },
  ],
  // 全リソースへ適用するタグ
  tags: {
    Application: '',
    Owner: '',
  },
};
