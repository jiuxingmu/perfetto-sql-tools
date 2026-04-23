import { Card, Col, Modal, Row, Table } from 'antd';

type TrendDiffModalProps = {
  open: boolean;
  openedRows: Record<string, unknown>[];
  closedRows: Record<string, unknown>[];
  onClose: () => void;
};

export function TrendDiffModal({ open, openedRows, closedRows, onClose }: TrendDiffModalProps) {
  return (
    <Modal
      title={`t1→t2 线程变化详情（新开 ${openedRows.length}，关闭 ${closedRows.length}）`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      destroyOnClose
    >
      <Row gutter={12}>
        <Col span={12}>
          <Card size="small" title={`新开线程 (${openedRows.length})`} style={{ borderColor: '#d1fae5' }}>
            <Table<Record<string, unknown>>
              rowKey={(r, i) => `opened-${String(r.utid)}-${i ?? 0}`}
              size="small"
              pagination={{ pageSize: 20 }}
              locale={{ emptyText: '无新开线程' }}
              columns={[
                { title: 'utid', dataIndex: 'utid', key: 'utid', width: 100 },
                { title: 'tid', dataIndex: 'tid', key: 'tid', width: 100 },
                { title: 'thread', dataIndex: 'thread', key: 'thread' },
                { title: 'process', dataIndex: 'process', key: 'process' },
              ]}
              dataSource={openedRows}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title={`关闭线程 (${closedRows.length})`} style={{ borderColor: '#fee2e2' }}>
            <Table<Record<string, unknown>>
              rowKey={(r, i) => `closed-${String(r.utid)}-${i ?? 0}`}
              size="small"
              pagination={{ pageSize: 20 }}
              locale={{ emptyText: '无关闭线程' }}
              columns={[
                { title: 'utid', dataIndex: 'utid', key: 'utid', width: 100 },
                { title: 'tid', dataIndex: 'tid', key: 'tid', width: 100 },
                { title: 'thread', dataIndex: 'thread', key: 'thread' },
                { title: 'process', dataIndex: 'process', key: 'process' },
              ]}
              dataSource={closedRows}
            />
          </Card>
        </Col>
      </Row>
    </Modal>
  );
}
