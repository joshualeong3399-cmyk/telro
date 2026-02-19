import { Result } from 'antd'
import { ToolOutlined } from '@ant-design/icons'

interface ComingSoonProps {
  title: string
}

const ComingSoon: React.FC<ComingSoonProps> = ({ title }) => (
  <Result
    icon={<ToolOutlined style={{ color: '#1677ff' }} />}
    title={title}
    subTitle="功能开发中，敬请期待…"
  />
)

export default ComingSoon
